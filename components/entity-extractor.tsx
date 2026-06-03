"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  entityType: string;
  name: string;
  content: string;
  frontMatter: Record<string, unknown>;
}

const TYPE_DOT: Record<string, string> = {
  character: "bg-amber-400", location: "bg-emerald-400", artifact: "bg-violet-400",
  lore: "bg-orange-400", document: "bg-sky-400", scenario: "bg-rose-400",
};

const TYPES = ["character", "location", "artifact", "lore", "document", "scenario"];

export default function EntityExtractor({
  projectSlug,
  text,
  provider,
  model,
  onClose,
}: {
  projectSlug: string;
  text: string;
  provider: string;
  model: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectSlug}/extract-entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, provider, model }),
        });
        if (!res.ok) {
          const b = await res.json() as { error?: string };
          throw new Error(b.error ?? "Extraction failed.");
        }
        const data = await res.json() as { entities: Candidate[] };
        setCandidates(data.entities);
        setSelected(new Set(data.entities.map((_, i) => i)));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  function setType(i: number, t: string) {
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, entityType: t } : c)));
  }

  function setName(i: number, name: string) {
    setCandidates((prev) => prev.map((c, idx) => (idx === i ? { ...c, name } : c)));
  }

  async function saveSelected() {
    setSaving(true);
    setError("");
    let saved = 0;
    try {
      for (const i of selected) {
        const c = candidates[i];
        const res = await fetch(`/api/projects/${projectSlug}/entities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: c.entityType,
            name: c.name,
            content: c.content,
            frontMatter: c.frontMatter,
          }),
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
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-stone-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="font-display text-lg font-semibold text-stone-800">Extract entities</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <p className="py-8 text-center text-sm text-stone-400">Reading the passage…</p>}

          {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {savedCount !== null ? (
            <div className="py-8 text-center">
              <p className="font-display text-3xl text-emerald-400">✓</p>
              <p className="mt-3 text-sm text-stone-600">Saved {savedCount} entit{savedCount === 1 ? "y" : "ies"}.</p>
            </div>
          ) : (
            !loading && !error && candidates.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-400">No entities found in this passage.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {candidates.map((c, i) => (
                  <li key={i} className={`rounded-sm border p-3 transition-colors ${selected.has(i) ? "border-stone-300 bg-stone-50" : "border-stone-200 opacity-60"}`}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="accent-stone-700" />
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[c.entityType] ?? "bg-stone-400"}`} />
                      <input
                        value={c.name}
                        onChange={(e) => setName(i, e.target.value)}
                        className="flex-1 rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-stone-800 hover:border-stone-200 focus:border-stone-400 focus:outline-none"
                      />
                      <select
                        value={c.entityType}
                        onChange={(e) => setType(i, e.target.value)}
                        className="rounded-sm border border-stone-200 bg-white px-1.5 py-0.5 text-xs capitalize text-stone-600 focus:outline-none"
                      >
                        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    {c.content && <p className="mt-2 pl-6 text-xs leading-relaxed text-stone-500">{c.content}</p>}
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        {savedCount === null && candidates.length > 0 && (
          <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3">
            <span className="text-xs text-stone-400">{selected.size} selected</span>
            <button
              onClick={saveSelected}
              disabled={saving || selected.size === 0}
              className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : `Save ${selected.size} to project`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
