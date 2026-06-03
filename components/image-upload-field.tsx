"use client";

import { useRef, useState } from "react";

/**
 * Upload an image to the project's asset storage and report back the public
 * URL + storage key. Used inside entity forms; stores image/imageKey in
 * front-matter. Backend is the storage abstraction (Supabase now, R2 later).
 */
export default function ImageUploadField({
  projectSlug,
  url,
  imageKey,
  onChange,
  suggestedPrompt,
}: {
  projectSlug: string;
  url?: string;
  imageKey?: string;
  onChange: (next: { url?: string; key?: string }) => void;
  suggestedPrompt?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [genMode, setGenMode] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  async function generate() {
    const prompt = genPrompt.trim();
    if (!prompt) return;
    setError("");
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Generation failed.");
      }
      const data = await res.json() as { url: string; key: string };
      onChange({ url: data.url, key: data.key });
      setGenMode(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/projects/${projectSlug}/assets`, { method: "POST", body: fd });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Upload failed.");
      }
      const data = await res.json() as { key: string; url: string };
      onChange({ url: data.url, key: data.key });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    const key = imageKey;
    onChange({ url: undefined, key: undefined });
    if (key) {
      await fetch(`/api/projects/${projectSlug}/assets?key=${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-stone-700">Image</label>

      {url ? (
        <div className="group relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-h-40 rounded-sm border border-stone-200 object-cover" />
          <button
            type="button"
            onClick={remove}
            className="absolute right-1.5 top-1.5 rounded-sm bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          >
            Remove
          </button>
        </div>
      ) : genMode ? (
        <div className="flex flex-col gap-2 rounded-sm border border-stone-300 p-3">
          <textarea
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
            placeholder="Describe the image — e.g. a fog-bound Victorian manor at dusk, oil-painting style"
            rows={2}
            autoFocus
            className="w-full resize-none rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={generating || !genPrompt.trim()}
              className="rounded-sm bg-stone-800 px-4 py-1.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
            >
              {generating ? "Generating…" : "✨ Generate"}
            </button>
            <button
              type="button"
              onClick={() => { setGenMode(false); setError(""); }}
              className="rounded-sm border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) upload(f);
            }}
            className={`flex h-28 w-full flex-col items-center justify-center gap-1 rounded-sm border border-dashed text-sm transition-colors ${
              dragOver ? "border-stone-500 bg-stone-100 text-stone-600" : "border-stone-300 text-stone-400 hover:border-stone-400 hover:text-stone-600"
            }`}
          >
            {uploading ? (
              <span>Uploading…</span>
            ) : (
              <>
                <span className="text-xl">⬆</span>
                <span>Click or drop an image</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setGenPrompt(suggestedPrompt ?? ""); setGenMode(true); }}
            className="self-start text-xs font-medium text-stone-500 transition-colors hover:text-stone-800"
          >
            ✨ Generate with AI
          </button>
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
