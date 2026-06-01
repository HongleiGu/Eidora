import { estimateCost } from '../pricing';
import type { CompletionOptions, CompletionResult, StreamChunk, ContentPart } from '../types';

const BASE_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';

// ── Message serialisation ─────────────────────────────────────────────────────

function serialisePart(part: ContentPart): unknown {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'image':
      if (part.url.startsWith('data:')) {
        const [header, data] = part.url.split(',');
        const mediaType = header.split(':')[1].split(';')[0];
        return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
      }
      return { type: 'image', source: { type: 'url', url: part.url } };
    default:
      console.warn(`[ai/anthropic] Unsupported part type "${(part as ContentPart).type}" — skipped`);
      return null;
  }
}

function serialiseMessages(messages: CompletionOptions['messages']) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role,
      content:
        typeof m.content === 'string'
          ? m.content
          : m.content.map(serialisePart).filter(Boolean),
    }));
}

function buildBody(opts: CompletionOptions, stream: boolean) {
  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.budget?.maxOutputTokens ?? opts.maxTokens ?? 8192;

  // System: explicit system opt OR first system-role message
  const systemMsg = opts.messages.find((m) => m.role === 'system');
  const system =
    opts.system ??
    (systemMsg && typeof systemMsg.content === 'string' ? systemMsg.content : undefined);

  return {
    model,
    max_tokens: maxTokens,
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(system && { system }),
    messages: serialiseMessages(opts.messages),
    stream,
  };
}

function headers(key: string) {
  return {
    'x-api-key': key,
    'anthropic-version': API_VERSION,
    'content-type': 'application/json',
  };
}

// ── Non-streaming ─────────────────────────────────────────────────────────────

export async function anthropicComplete(opts: CompletionOptions): Promise<CompletionResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');

  const model = opts.model ?? DEFAULT_MODEL;
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(buildBody(opts, false)),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    content: { type: string; text?: string }[];
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  const text = data.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  const { input_tokens, output_tokens } = data.usage;
  return {
    text,
    model: data.model,
    provider: 'anthropic',
    usage: {
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      estimatedCostUsd: estimateCost(data.model, input_tokens, output_tokens),
    },
  };
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function* anthropicStream(
  opts: CompletionOptions,
): AsyncGenerator<StreamChunk> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');

  const model = opts.model ?? DEFAULT_MODEL;
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(buildBody(opts, true)),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  if (!res.body)  throw new Error('Anthropic response has no body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let inputTokens = 0;
  let outputTokens = 0;
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      const event = JSON.parse(raw) as Record<string, unknown>;

      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield { delta: delta.text, done: false };
        }
      } else if (event.type === 'message_start') {
        const msg = event.message as { usage?: { input_tokens?: number } };
        inputTokens = msg.usage?.input_tokens ?? 0;
      } else if (event.type === 'message_delta') {
        const usage = (event.usage as { output_tokens?: number } | undefined);
        outputTokens = usage?.output_tokens ?? outputTokens;
      } else if (event.type === 'message_stop') {
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
