// ── Providers ─────────────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai' | 'groq' | 'openrouter' | 'ollama';

// ── Message content ───────────────────────────────────────────────────────────
// Designed for multimodal from the start. Add new part types without breaking
// existing providers — unknown parts are dropped with a warning.

export type TextPart  = { type: 'text';  text: string };
export type ImagePart = {
  type: 'image';
  url: string;               // https:// URL or data: URI
  mediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};
// Reserved for future parts — not yet serialised by any provider
export type AudioPart = { type: 'audio'; url: string; format: 'mp3' | 'wav' | 'ogg' };
export type FilePart  = { type: 'file';  name: string; data: string; mediaType: string };

export type ContentPart = TextPart | ImagePart | AudioPart | FilePart;

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  /** Shorthand: pass a plain string and it is treated as a single TextPart. */
  content: string | ContentPart[];
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface CompletionOptions {
  messages: Message[];
  /** Separate system prompt — merged into messages for providers that don't
   *  support a dedicated system field (OpenAI-compat, Ollama). */
  system?: string;

  provider?: Provider;   // default: 'anthropic'
  model?: string;        // default: provider's recommended model

  maxTokens?: number;    // default: 8192
  temperature?: number;  // default: 1.0

  /** Budget constraints. estimatedCostUsd is checked post-response (non-streaming)
   *  or at stream end. maxOutputTokens is forwarded to the API as max_tokens. */
  budget?: {
    maxOutputTokens?: number;
    maxCostUsd?: number;
  };
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  /** Undefined if the model is not in the pricing table. */
  estimatedCostUsd?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: Provider;
  usage: Usage;
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export interface StreamChunk {
  /** Non-empty on each intermediate chunk. */
  delta: string;
  done: boolean;
  /** Populated only on the final chunk (done === true). */
  usage?: Usage;
  model?: string;
}
