"use client";

import { useState } from "react";

interface RelationRow {
  id: string;
  source_slug: string;
  target_slug: string;
  relation_type: string;
  attitude: number | null;
  two_way: boolean;
  note: string | null;
}

const inputClass =
  "w-full rounded-sm border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none transition-colors";

function attitudeColor(a: number | null): string {
  if (a === null) return "text-stone-400";
  if (a >= 50)  return "text-green-600";
  if (a > 0)    return "text-emerald-600";
  if (a === 0)  return "text-stone-400";
  if (a > -50)  return "text-orange-600";
  return "text-red-600";
}

function fmt(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RelationsSection({
  projectSlug,
  entitySlug,
  initialRelations,
}: {
  projectSlug: string;
  entitySlug: string;
  initialRelations: RelationRow[];
}) {
  const [relations, setRelations] = useState<RelationRow[]>(initialRelations);
  const [showForm, setShowForm] = useState(false);

  // Add form state
  const [targetSlug, setTargetSlug] = useState("");
  const [relationType, setRelationType] = useState("");
  const [attitude, setAttitude] = useState<string>("");
  const [twoWay, setTwoWay] = useState(false);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  function resetForm() {
    setTargetSlug(""); setRelationType(""); setAttitude("");
    setTwoWay(false); setNote(""); setFormError("");
    setShowForm(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!targetSlug.trim() || !relationType.trim()) {
      setFormError("Target and relation type are required.");
      return;
    }
    setFormError(""); setAdding(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSlug: entitySlug,
          targetSlug: targetSlug.trim(),
          relationType: relationType.trim(),
          attitude: attitude !== "" ? Number(attitude) : undefined,
          twoWay,
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Failed to add relation.");
      }
      const newRel = await res.json() as RelationRow;
      setRelations((prev) => [...prev, newRel]);
      resetForm();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setRelations((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/projects/${projectSlug}/relations/${id}`, { method: "DELETE" });
  }

  return (
    <section className="overflow-hidden rounded-sm border border-stone-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3.5">
        <h2 className="text-xs font-medium uppercase tracking-wider text-stone-400">
          Relations <span className="text-stone-300">({relations.length})</span>
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {/* List */}
      {relations.length === 0 && !showForm ? (
        <p className="px-6 py-8 text-center text-sm text-stone-400">No relations yet.</p>
      ) : (
        <ul>
          {relations.map((r) => {
            const outgoing = r.source_slug === entitySlug;
            const peer = outgoing ? r.target_slug : r.source_slug;
            return (
              <li
                key={r.id}
                className="group flex items-center gap-3 border-b border-stone-50 px-6 py-3 last:border-b-0"
              >
                {/* Direction */}
                <span className="w-3 shrink-0 text-center text-xs text-stone-400">
                  {outgoing ? "→" : "←"}
                </span>

                {/* Target + type */}
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <a
                    href={`/projects/${projectSlug}`}
                    className="text-sm font-medium text-stone-800 hover:underline"
                    title={peer}
                  >
                    {fmt(peer)}
                  </a>
                  <span className="truncate text-xs italic text-stone-400">
                    {r.relation_type}
                  </span>
                  {r.two_way && (
                    <span className="text-xs text-stone-300" title="Two-way">↔</span>
                  )}
                </div>

                {/* Attitude */}
                {r.attitude !== null && (
                  <span className={`shrink-0 text-sm font-medium tabular-nums ${attitudeColor(r.attitude)}`}>
                    {r.attitude > 0 ? "+" : ""}{r.attitude}
                  </span>
                )}

                {/* Note tooltip */}
                {r.note && (
                  <span className="shrink-0 text-xs text-stone-300" title={r.note}>
                    ✎
                  </span>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="shrink-0 text-sm text-stone-200 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  title="Remove relation"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="border-t border-stone-100 bg-stone-50 px-6 py-4"
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-400">
            New relation
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Target entity slug *</label>
              <input
                className={inputClass}
                placeholder="sergeant-lewis"
                value={targetSlug}
                onChange={(e) => setTargetSlug(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Relation type *</label>
              <input
                className={inputClass}
                placeholder="trusts completely"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Attitude (−100 → +100)</label>
              <input
                type="number"
                min={-100}
                max={100}
                className={inputClass}
                placeholder="0"
                value={attitude}
                onChange={(e) => setAttitude(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-stone-500">Note (optional)</label>
              <input
                className={inputClass}
                placeholder="Why this relation exists…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={twoWay}
              onChange={(e) => setTwoWay(e.target.checked)}
              className="rounded-sm accent-stone-700"
            />
            Two-way (also creates the reverse relation)
          </label>

          {formError && (
            <p className="mt-2 text-xs text-red-600">{formError}</p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={adding}
              className="rounded-sm bg-stone-800 px-4 py-1.5 text-xs font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-sm border border-stone-300 px-4 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
