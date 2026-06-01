/**
 * Unified AI abstraction.
 *
 * Usage:
 *   import { complete, stream } from '@/lib/ai';
 *
 *   // Non-streaming
 *   const result = await complete({
 *     provider: 'anthropic',   // default
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   });
 *
 *   // Streaming (async generator)
 *   for await (const chunk of stream({ messages: [...] })) {
 *     if (!chunk.done) process.stdout.write(chunk.delta);
 *     else console.log('tokens:', chunk.usage);
 *   }
 *
 * Providers: 'anthropic' | 'openai' | 'groq' | 'openrouter' | 'ollama'
 * Keys loaded from process.env automatically.
 */

export type { CompletionOptions, CompletionResult, StreamChunk, Message, ContentPart, Usage, Provider } from './types';

import { anthropicComplete, anthropicStream } from './providers/anthropic';
import { openAICompatComplete, openAICompatStream } from './providers/openai-compat';
import { ollamaComplete, ollamaStream } from './providers/ollama';
import type { CompletionOptions, CompletionResult, StreamChunk, Provider } from './types';

const VALID_PROVIDERS: Provider[] = ['anthropic', 'openai', 'groq', 'openrouter', 'ollama'];

/** Default provider — overridable via AI_DEFAULT_PROVIDER env var. */
export function defaultProvider(): Provider {
  const env = process.env.AI_DEFAULT_PROVIDER as Provider | undefined;
  return env && VALID_PROVIDERS.includes(env) ? env : 'anthropic';
}

// ── Non-streaming ─────────────────────────────────────────────────────────────

export async function complete(opts: CompletionOptions): Promise<CompletionResult> {
  const provider = opts.provider ?? defaultProvider();

  switch (provider) {
    case 'anthropic':
      return anthropicComplete(opts);
    case 'openai':
    case 'groq':
    case 'openrouter':
      return openAICompatComplete(opts, provider);
    case 'ollama':
      return ollamaComplete(opts);
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export async function* stream(opts: CompletionOptions): AsyncGenerator<StreamChunk> {
  const provider = opts.provider ?? defaultProvider();

  switch (provider) {
    case 'anthropic':
      yield* anthropicStream(opts);
      break;
    case 'openai':
    case 'groq':
    case 'openrouter':
      yield* openAICompatStream(opts, provider);
      break;
    case 'ollama':
      yield* ollamaStream(opts);
      break;
    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}

// ── Convenience: stream → SSE ReadableStream for Next.js route handlers ───────
// Usage in a route.ts:
//   return streamToResponse(stream({ messages }));

export function streamToResponse(
  gen: AsyncGenerator<StreamChunk>,
  onDone?: (final: StreamChunk) => void,
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          if (chunk.done) onDone?.(chunk);
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
