"use client";

import { useRef, useState, useEffect } from "react";
import EntityExtractor from "./entity-extractor";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
}

interface ModelInfo { id: string; vision?: boolean }

// Provider → models offered in the picker. First entry is the default.
// `vision: true` marks models that accept image input (gates the attach button).
const PROVIDER_MODELS: Record<string, { label: string; models: ModelInfo[] }> = {
  groq: { label: "Groq", models: [
    { id: "llama-3.3-70b-versatile" },
    { id: "llama-3.1-8b-instant" },
    { id: "llama-3.2-90b-vision-preview", vision: true },
  ] },
  openrouter: { label: "OpenRouter", models: [
    { id: "anthropic/claude-sonnet-4-6", vision: true },
    { id: "openai/gpt-4o", vision: true },
    { id: "google/gemini-2.0-flash-001", vision: true },
  ] },
  anthropic: { label: "Anthropic", models: [
    { id: "claude-sonnet-4-6", vision: true },
    { id: "claude-haiku-4-5-20251001", vision: true },
  ] },
  openai: { label: "OpenAI", models: [
    { id: "gpt-4o", vision: true },
    { id: "gpt-4o-mini", vision: true },
  ] },
  ollama: { label: "Ollama", models: [
    { id: "llama3.2" },
    { id: "llava", vision: true },
  ] },
};

interface Attachment { dataUrl: string; name: string }

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
}

export default function StudioChat({
  projectSlug,
  getEditorText,
  onInsert,
}: {
  projectSlug: string;
  getEditorText: () => string;
  onInsert: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [lastUsage, setLastUsage] = useState<Usage | null>(null);
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState(PROVIDER_MODELS.groq.models[0].id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [extractText, setExtractText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const visionCapable = !!PROVIDER_MODELS[provider]?.models.find((m) => m.id === model)?.vision;

  function changeProvider(p: string) {
    setProvider(p);
    setModel(PROVIDER_MODELS[p].models[0].id);
    setAttachments([]);
  }

  async function addImages(files: FileList | null) {
    if (!files) return;
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 5 * 1024 * 1024) { setError("Images must be under 5MB."); continue; }
      next.push({ dataUrl: await readAsDataUrl(f), name: f.name });
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 4));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const images = attachments.map((a) => a.dataUrl);
    const userLabel = images.length ? `${text}  📎×${images.length}` : text;
    const next: ChatMessage[] = [...messages, { role: "user", content: userLabel }];
    setMessages(next);
    setInput("");
    setError("");
    setAttachments([]);
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/projects/${projectSlug}/studio/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send raw text (not the label) for the model; images travel separately.
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          editorText: getEditorText(),
          provider, model,
          images,
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error((body as { error?: string }).error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";

        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data: ")) continue;
          const chunk = JSON.parse(line.slice(6)) as {
            delta: string; done: boolean; usage?: Usage;
          };
          if (chunk.delta) {
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                role: "assistant",
                content: copy[copy.length - 1].content + chunk.delta,
              };
              return copy;
            });
          }
          if (chunk.done && chunk.usage) setLastUsage(chunk.usage);
        }
      }
    } catch (err) {
      setError((err as Error).message);
      // Drop the empty assistant placeholder on error
      setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="border-b border-stone-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold tracking-wide text-stone-700">
            Assistant
          </h2>
          {lastUsage && (
            <span className="text-xs text-stone-400" title="Tokens (in / out) for the last reply">
              {lastUsage.inputTokens}→{lastUsage.outputTokens} tok
              {lastUsage.estimatedCostUsd != null && ` · $${lastUsage.estimatedCostUsd.toFixed(4)}`}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => changeProvider(e.target.value)}
            disabled={streaming}
            className="rounded-sm border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none disabled:opacity-50"
          >
            {Object.entries(PROVIDER_MODELS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={streaming}
            className="min-w-0 flex-1 rounded-sm border border-stone-200 bg-white px-2 py-1 text-xs text-stone-600 focus:border-stone-400 focus:outline-none disabled:opacity-50"
          >
            {PROVIDER_MODELS[provider].models.map((m) => (
              <option key={m.id} value={m.id}>{m.id}{m.vision ? " 👁" : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mt-8 text-center text-sm text-stone-400">
            <p className="font-display text-2xl text-stone-300">✶</p>
            <p className="mt-3">Ask the assistant to develop characters,</p>
            <p>suggest plot twists, or draft a scene.</p>
            <p className="mt-4 text-xs text-stone-300">
              Reference entities with <span className="rounded-sm bg-emerald-50 px-1 text-emerald-700">@slug</span>
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-sm bg-stone-800 px-3 py-2 text-sm leading-relaxed text-stone-50"
                  : "group max-w-full text-sm leading-relaxed text-stone-800"
              }
            >
              <div className="whitespace-pre-wrap font-display">
                {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
              </div>
              {m.role === "assistant" && m.content && !streaming && (
                <div className="mt-2 flex gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => onInsert(m.content)}
                    className="text-xs text-stone-400 transition-colors hover:text-stone-700"
                  >
                    ↵ Insert into draft
                  </button>
                  <button
                    onClick={() => setExtractText(m.content)}
                    className="text-xs text-stone-400 transition-colors hover:text-stone-700"
                  >
                    ✦ Extract entities
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {error && (
          <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-stone-200 p-3">
        {/* Attachment thumbnails */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div key={i} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.dataUrl} alt={a.name} className="h-12 w-12 rounded-sm border border-stone-200 object-cover" />
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-stone-700 text-[10px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={streaming || !visionCapable}
            title={visionCapable ? "Attach image" : "Current model doesn't support images — pick a vision model"}
            className="shrink-0 rounded-sm border border-stone-300 px-2.5 py-2 text-sm text-stone-500 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            📎
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { addImages(e.target.files); e.target.value = ""; }}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask the assistant… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={streaming}
            className="flex-1 resize-none rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-40"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </div>

      {extractText !== null && (
        <EntityExtractor
          projectSlug={projectSlug}
          text={extractText}
          provider={provider}
          model={model}
          onClose={() => setExtractText(null)}
        />
      )}
    </div>
  );
}
