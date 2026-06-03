"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateStoryButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() || undefined }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Generation failed.");
      }
      const data = await res.json() as { slug: string };
      router.push(`/projects/${data.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-sm border border-dashed border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-stone-400 hover:bg-stone-50"
      >
        ✨ Generate a complete story
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-stone-200 bg-white p-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-stone-700">
          Generate a complete story <span className="text-xs font-normal text-stone-400">— world, cast, and a playable scenario</span>
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A seed idea (optional) — e.g. 'a heist gone wrong on a generation ship'. Leave blank to let the AI surprise you."
          rows={2}
          autoFocus
          className="w-full resize-none rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none"
        />
      </div>
      {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-sm bg-stone-800 px-5 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? "Writing your story…" : "✨ Generate"}
        </button>
        <button
          onClick={() => { setOpen(false); setError(""); }}
          className="rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-stone-400">This creates a new project with a full world, cast, and scenario you can then edit or play.</p>
    </div>
  );
}
