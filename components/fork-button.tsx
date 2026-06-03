"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForkButton({
  projectSlug,
  defaultName,
}: {
  projectSlug: string;
  defaultName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fork() {
    if (!name.trim()) { setError("Name is required."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? "Fork failed.");
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
        className="shrink-0 rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
        title="Create your own editable copy to play"
      >
        ⑂ Start Campaign
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Campaign name"
        className="w-48 rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") fork(); if (e.key === "Escape") setOpen(false); }}
      />
      <button
        onClick={fork}
        disabled={loading}
        className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
      >
        {loading ? "Forking…" : "Create"}
      </button>
      <button
        onClick={() => { setOpen(false); setError(""); }}
        className="rounded-sm border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
