"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BundleEntity { name: string; content?: string; frontMatter?: Record<string, unknown> }
interface Bundle {
  scenario: { name: string; description?: string; premise?: string; solution?: string; winCondition?: string; mechanics?: string[] };
  characters?: BundleEntity[];
  locations?: BundleEntity[];
  artifacts?: BundleEntity[];
}

const GAME_TYPES = [
  { value: "detective", label: "Detective" },
  { value: "turtle_soup", label: "Turtle Soup" },
  { value: "coc", label: "Call of Cthulhu" },
  { value: "story", label: "Story" },
  { value: "sandbox", label: "Sandbox" },
];

const GROUP_DOT: Record<string, string> = {
  characters: "bg-amber-400", locations: "bg-emerald-400", artifacts: "bg-violet-400",
};

const inputClass = "w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none transition-colors";

export default function ScenarioGenerator({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const [premise, setPremise] = useState("");
  const [gameType, setGameType] = useState("detective");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);

  async function generate() {
    setError(""); setLoading(true); setBundle(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/generate-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ premise: premise.trim(), gameType }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Generation failed.");
      }
      const data = await res.json() as { bundle: Bundle };
      setBundle(data.bundle);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function createAll() {
    if (!bundle) return;
    setCreating(true); setError("");
    try {
      const res = await fetch(`/api/projects/${projectSlug}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle, gameType }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Could not create scenario.");
      }
      const data = await res.json() as { slug: string };
      router.push(`/projects/${projectSlug}/scenario/${data.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  function updateScenario(field: string, value: string) {
    setBundle((b) => b ? { ...b, scenario: { ...b.scenario, [field]: value } } : b);
  }

  function renameItem(group: keyof Bundle, i: number, name: string) {
    setBundle((b) => {
      if (!b) return b;
      const arr = [...(b[group] as BundleEntity[])];
      arr[i] = { ...arr[i], name };
      return { ...b, [group]: arr };
    });
  }

  function removeItem(group: keyof Bundle, i: number) {
    setBundle((b) => {
      if (!b) return b;
      const arr = (b[group] as BundleEntity[]).filter((_, idx) => idx !== i);
      return { ...b, [group]: arr };
    });
  }

  const groups: ("characters" | "locations" | "artifacts")[] = ["characters", "locations", "artifacts"];
  const total = bundle ? groups.reduce((n, g) => n + (bundle[g]?.length ?? 0), 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Prompt form */}
      <div className="flex flex-col gap-4 rounded-sm border border-stone-200 bg-white p-6 paper">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Premise / request <span className="text-xs font-normal text-stone-400">optional</span></label>
            <textarea
              className={`${inputClass} resize-none leading-relaxed`}
              rows={3}
              placeholder="A locked-room murder at a séance… or leave blank to let the AI invent one for your world."
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Game type</label>
            <select className={`${inputClass} cursor-pointer`} value={gameType} onChange={(e) => setGameType(e.target.value)}>
              {GAME_TYPES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <button
            onClick={generate}
            disabled={loading}
            className="rounded-sm bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Generating…" : bundle ? "↻ Regenerate" : "✶ Generate scenario"}
          </button>
        </div>
      </div>

      {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Preview */}
      {bundle && (
        <div className="flex flex-col gap-5">
          {/* Scenario */}
          <div className="rounded-sm border border-rose-200 bg-rose-50/40 p-6">
            <span className="rounded-sm border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Scenario</span>
            <input
              className="mt-3 w-full bg-transparent font-display text-2xl font-semibold text-stone-900 focus:outline-none"
              value={bundle.scenario.name}
              onChange={(e) => updateScenario("name", e.target.value)}
            />
            {bundle.scenario.premise && (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-400">Premise</p>
                <p className="mt-1 text-sm leading-relaxed text-stone-700">{bundle.scenario.premise}</p>
              </div>
            )}
            {bundle.scenario.solution && (
              <div className="mt-3 rounded-sm border border-dashed border-stone-300 bg-white/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Solution (GM only)</p>
                <p className="mt-1 text-sm italic leading-relaxed text-stone-600">{bundle.scenario.solution}</p>
              </div>
            )}
          </div>

          {/* Cast groups */}
          {groups.map((g) => {
            const items = bundle[g] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={g} className="rounded-sm border border-stone-200 bg-white">
                <p className="border-b border-stone-100 px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-stone-400 capitalize">
                  {g} ({items.length})
                </p>
                <ul>
                  {items.map((it, i) => (
                    <li key={i} className="group flex items-start gap-3 border-b border-stone-50 px-5 py-3 last:border-b-0">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${GROUP_DOT[g]}`} />
                      <div className="min-w-0 flex-1">
                        <input
                          className="w-full bg-transparent text-sm font-medium text-stone-800 focus:outline-none"
                          value={it.name}
                          onChange={(e) => renameItem(g, i, e.target.value)}
                        />
                        {it.content && <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{it.content}</p>}
                      </div>
                      <button
                        onClick={() => removeItem(g, i)}
                        className="shrink-0 text-stone-300 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Create */}
          <div className="flex items-center gap-3">
            <button
              onClick={createAll}
              disabled={creating}
              className="rounded-sm bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : `Create scenario + ${total} entit${total === 1 ? "y" : "ies"}`}
            </button>
            <span className="text-xs text-stone-400">Everything is editable later.</span>
          </div>
        </div>
      )}
    </div>
  );
}
