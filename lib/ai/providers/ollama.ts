/**
 * Ollama local provider.
 * Uses /api/chat with newline-delimited JSON streaming (not SSE).
 * Base URL read from OLLAMA_API_BASE (default: http://localhost:11434).
 */
import { estimateCost } from '../pricing';
import type { CompletionOptions, CompletionResult, StreamChunk, ContentPart } from '../types';

const DEFAULT_MODEL = 'llama3.2';

function baseUrl(): string {
  return (process.env.OLLAMA_API_BASE ?? 'http://localhost:11434').replace(/\/$/, '');
}

// ── Message serialisation ─────────────────────────────────────────────────────

function serialisePart(part: ContentPart): { text?: string; images?: string[] } {
  if (part.type === 'text')  return { text: part.text };
  if (part.type === 'image') {
    // Ollama expects base64 data without the data: prefix
    const data = part.url.startsWith('data:')
      ? part.url.split(',')[1]
      : part.url; // URL — Ollama won't fetch it, but pass through
    return { images: [data] };
  }
  console.warn(`[ai/ollama] Unsupported part type "${(part as ContentPart).type}" — skipped`);
  return {};
}

function serialiseMessages(opts: CompletionOptions) {
  const out: { role: string; content: string; images?: string[] }[] = [];

  const hasSystemMsg = opts.messages.some((m) => m.role === 'system');
  if (opts.system && !hasSystemMsg) {
    out.push({ role: 'system', content: opts.system });
  }

  for (const m of opts.messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
    } else {
      const texts: string[] = [];
      const images: string[] = [];
      for (const part of m.content) {
        const s = serialisePart(part);
        if (s.text) texts.push(s.text);
        if (s.images) images.push(...s.images);
      }
      out.push({ role: m.role, content: texts.join('\n'), ...(images.length && { images }) });
    }
  }
  return out;
}

function buildBody(opts: CompletionOptions, model: string, stream: boolean) {
  return {
    model,
    messages: serialiseMessages(opts),
    stream,
    options: {
      ...(opts.maxTokens && { num_predict: opts.budget?.maxOutputTokens ?? opts.maxTokens }),
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    },
  };
}

// ── Non-streaming ─────────────────────────────────────────────────────────────

export async function ollamaComplete(opts: CompletionOptions): Promise<CompletionResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${baseUrl()}/api/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(opts, model, false)),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    message: { content: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };

  const inputTokens = data.prompt_eval_count ?? 0;
  const outputTokens = data.eval_count ?? 0;
  return {
    text: data.message.content,
    model,
    provider: 'ollama',
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(model, inputTokens, outputTokens),
    },
  };
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function* ollamaStream(opts: CompletionOptions): AsyncGenerator<StreamChunk> {
  const model = opts.model ?? DEFAULT_MODEL;
  const url = `${baseUrl()}/api/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(opts, model, true)),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  if (!res.body)  throw new Error('Ollama response has no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const event = JSON.parse(trimmed) as {
        message?: { content?: string };
        done: boolean;
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const delta = event.message?.content ?? '';
      if (!event.done) {
        if (delta) yield { delta, done: false };
      } else {
        const inputTokens = event.prompt_eval_count ?? 0;
        const outputTokens = event.eval_count ?? 0;
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
      }
    }
  }
}
