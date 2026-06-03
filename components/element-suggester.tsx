"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  entityType: string;
  name: string;
  content: string;
  frontMatter: Record<string, unknown>;
}

const TYPES = ["character", "location", "artifact", "lore", "document", "scenario"];
const DOT: Record<string, string> = {
  character: "bg-amber-400", location: "bg-emerald-400", artifact: "bg-violet-400",
  lore: "bg-orange-400", document: "bg-sky-400", scenario: "bg-rose-400",
};

export default function ElementSuggester({
  projectSlug,
  defaultType,
  onClose,
}: {
  projectSlug: string;
  defaultType?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState(defaultType ?? "any");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState<number | null>(null);

  async function suggest() {
    setLoading(true); setError(""); setCandidates([]); setSavedCount(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/suggest-element`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: type === "any" ? undefined : type, hint: hint.trim() || undefined }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Suggestion failed.");
      }
      const data = await res.json() as { entities: Candidate[] };
      setCandidates(data.entities);
      setSelected(new Set(data.entities.map((_, i) => i)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSelected() {
    setSaving(true); setError("");
    let saved = 0;
    try {
      for (const i of selected) {
        const c = candidates[i];
        const res = await fetch(`/api/projects/${projectSlug}/entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: c.entityType, name: c.name, content: c.content, frontMatter: c.frontMatter }),
        });
        if (res.ok) saved++;
      }
      setSavedCount(saved);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-stone-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-stone-800">Suggest an element</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>

        {/* Controls */}
        <div className="flex items-end gap-2 border-b border-stone-100 px-5 py-3">
          <div>
            <label className="mb-1 block text-xs text-stone-500">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="cursor-pointer rounded-sm border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700 focus:outline-none">
              <option value="any">Surprise me</option>
              {TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-stone-500">Nudge (optional)</label>
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. someone with a grudge" className="w-full rounded-sm border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none" />
          </div>
          <button onClick={suggest} disabled={loading} className="rounded-sm bg-stone-800 px-4 py-1.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50">
            {loading ? "…" : candidates.length ? "↻" : "✨ Suggest"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="py-8 text-center text-sm text-stone-400">Imagining…</p>}
          {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {savedCount !== null ? (
            <div className="py-8 text-center">
              <p className="font-display text-3xl text-emerald-400">✓</p>
              <p className="mt-3 text-sm text-stone-600">Added {savedCount} to your project.</p>
            </div>
          ) : !loading && candidates.length === 0 && !error ? (
            <p className="py-8 text-center text-sm text-stone-400">Pick a type and hit Suggest.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {candidates.map((c, i) => (
                <li key={i} className={`rounded-sm border p-3 transition-colors ${selected.has(i) ? "border-stone-300 bg-stone-50" : "border-stone-200 opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selected.has(i)} onChange={() => setSelected((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })} className="accent-stone-700" />
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[c.entityType] ?? "bg-stone-400"}`} />
                    <span className="flex-1 text-sm font-medium text-stone-800">{c.name}</span>
                    <span className="text-xs capitalize text-stone-400">{c.entityType}</span>
                  </div>
                  {c.content && <p className="mt-1.5 pl-6 text-xs leading-relaxed text-stone-500">{c.content}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {savedCount === null && candidates.length > 0 && (
          <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3">
            <span className="text-xs text-stone-400">{selected.size} selected</span>
            <button onClick={saveSelected} disabled={saving || selected.size === 0} className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50">
              {saving ? "Adding…" : `Add ${selected.size} to project`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
