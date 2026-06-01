/**
 * OpenAI-compatible provider — covers OpenAI, Groq, and OpenRouter.
 * All three share the same /v1/chat/completions format and SSE streaming protocol.
 */
import { estimateCost } from '../pricing';
import type { CompletionOptions, CompletionResult, StreamChunk, ContentPart, Provider } from '../types';

// ── Provider config ───────────────────────────────────────────────────────────

interface ProviderConfig {
  baseUrl: string;
  envKey: string;
  defaultModel: string;
  extraHeaders?: Record<string, string>;
}

const CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'anthropic/claude-sonnet-4-6',
    extraHeaders: {
      'HTTP-Referer': 'https://eidora.app',
      'X-Title': 'Eidora',
    },
  },
};

// ── Message serialisation ─────────────────────────────────────────────────────

function serialisePart(part: ContentPart): unknown {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'image':
      return { type: 'image_url', image_url: { url: part.url } };
    default:
      console.warn(`[ai/openai-compat] Unsupported part type "${(part as ContentPart).type}" — skipped`);
      return null;
  }
}

function serialiseMessages(opts: CompletionOptions) {
  const out: { role: string; content: unknown }[] = [];

  // Inject system prompt as first system message if provided separately
  const hasSystemMsg = opts.messages.some((m) => m.role === 'system');
  if (opts.system && !hasSystemMsg) {
    out.push({ role: 'system', content: opts.system });
  }

  for (const m of opts.messages) {
    out.push({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content.map(serialisePart).filter(Boolean),
    });
  }
  return out;
}

function buildBody(opts: CompletionOptions, model: string, stream: boolean) {
  return {
    model,
    messages: serialiseMessages(opts),
    max_tokens: opts.budget?.maxOutputTokens ?? opts.maxTokens ?? 8192,
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    stream,
    ...(stream && { stream_options: { include_usage: true } }),
  };
}

function getConfig(provider: Provider): ProviderConfig {
  const cfg = CONFIGS[provider];
  if (!cfg) throw new Error(`Unknown OpenAI-compat provider: ${provider}`);
  return cfg;
}

function getKey(cfg: ProviderConfig): string {
  const key = process.env[cfg.envKey];
  if (!key) throw new Error(`${cfg.envKey} is not set`);
  return key;
}

function reqHeaders(cfg: ProviderConfig, key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...cfg.extraHeaders,
  };
}

// ── Non-streaming ─────────────────────────────────────────────────────────────

export async function openAICompatComplete(
  opts: CompletionOptions,
  provider: Provider,
): Promise<CompletionResult> {
  const cfg = getConfig(provider);
  const key = getKey(cfg);
  const model = opts.model ?? cfg.defaultModel;

  const res = await fetch(cfg.baseUrl, {
    method: 'POST',
    headers: reqHeaders(cfg, key),
    body: JSON.stringify(buildBody(opts, model, false)),
  });

  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    choices: { message: { content: string } }[];
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  const text = data.choices[0]?.message?.content ?? '';
  const { prompt_tokens, completion_tokens } = data.usage;
  return {
    text,
    model: data.model,
    provider,
    usage: {
      inputTokens: prompt_tokens,
      outputTokens: completion_tokens,
      estimatedCostUsd: estimateCost(data.model, prompt_tokens, completion_tokens),
    },
  };
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function* openAICompatStream(
  opts: CompletionOptions,
  provider: Provider,
): AsyncGenerator<StreamChunk> {
  const cfg = getConfig(provider);
  const key = getKey(cfg);
  const model = opts.model ?? cfg.defaultModel;

  const res = await fetch(cfg.baseUrl, {
    method: 'POST',
    headers: reqHeaders(cfg, key),
    body: JSON.stringify(buildBody(opts, model, true)),
  });

  if (!res.ok) throw new Error(`${provider} ${res.status}: ${await res.text()}`);
  if (!res.body)  throw new Error(`${provider} response has no body`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') {
        yield {
          delta: '',
          done: true,
          model,
          usage: {
            inputTokens,
            outputTokens,
            estimatedCostUsd: estimateCost(model, inputTokens, outputTokens),
          },
        };
        return;
      }
      if (!raw) continue;

      const event = JSON.parse(raw) as {
        choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const delta = event.choices?.[0]?.delta?.content;
      if (delta) yield { delta, done: false };

      if (event.usage) {
        inputTokens = event.usage.prompt_tokens ?? inputTokens;
        outputTokens = event.usage.completion_tokens ?? outputTokens;
      }
    }
  }
}
