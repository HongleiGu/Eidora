"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ScenarioOpt { slug: string; name: string; gameType?: string; hasBible?: boolean }

export default function NewSessionForm({
  projectSlug,
  scenarios,
}: {
  projectSlug: string;
  scenarios: ScenarioOpt[];
}) {
  const router = useRouter();
  const [scenarioSlug, setScenarioSlug] = useState(scenarios[0]?.slug ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = scenarios.find((s) => s.slug === scenarioSlug);
  const needsBible = selected && !selected.hasBible;

  if (scenarios.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
        No scenarios yet — a session needs one to play.
        <div className="mt-3">
          <Link href={`/projects/${projectSlug}/generate`} className="font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900">
            ✶ Generate a scenario →
          </Link>
        </div>
      </div>
    );
  }

  async function start() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioSlug }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Could not start session.");
      }
      const data = await res.json() as { id: string };
      router.push(`/projects/${projectSlug}/play/${data.id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-stone-200 bg-white p-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">Scenario</label>
          <select
            value={scenarioSlug}
            onChange={(e) => setScenarioSlug(e.target.value)}
            className="w-full cursor-pointer rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
          >
            {scenarios.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}{s.gameType ? ` · ${s.gameType.replace("_", " ")}` : ""}</option>
            ))}
          </select>
        </div>
        <button
          onClick={start}
          disabled={loading || !scenarioSlug}
          className="rounded-sm bg-stone-800 px-5 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? (needsBible ? "Writing the story…" : "Starting…") : "▶ Start session"}
        </button>
      </div>

      {needsBible && (
        <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          ⚠ This scenario has no fixed story yet. On start, the AI will write its <strong>canonical truth</strong> —
          every character's real background, the true sequence of events, and the solution. This becomes the story's
          canon for all future sessions (you can edit the scenario later to change it).
        </p>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
