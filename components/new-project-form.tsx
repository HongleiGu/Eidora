"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const GENRES = [
  "Detective", "Mystery", "Horror", "Fantasy",
  "Sci-Fi", "Historical", "Contemporary", "Thriller", "COC",
];

export default function NewProjectForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [worldName, setWorldName] = useState("");
  const [era, setEra] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleGenre(g: string) {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Project name is required."); return; }
    if (!worldName.trim()) { setError("World name is required."); return; }

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          worldName: worldName.trim(),
          era: era.trim() || undefined,
          genre: genres,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Something went wrong.");
      }
      const data = await res.json() as { slug: string };
      router.push(`/projects/${data.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Project name */}
      <Field label="Project name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!worldName) setWorldName(e.target.value);
          }}
          placeholder="Mystery of Blackwood Manor"
          className={inputClass}
          autoFocus
        />
      </Field>

      {/* World name */}
      <Field label="World / setting name" required>
        <input
          type="text"
          value={worldName}
          onChange={(e) => setWorldName(e.target.value)}
          placeholder="Victorian London"
          className={inputClass}
        />
      </Field>

      {/* Era */}
      <Field label="Era" hint="Optional — e.g. 1890s, Modern Day, Far Future">
        <input
          type="text"
          value={era}
          onChange={(e) => setEra(e.target.value)}
          placeholder="1890s"
          className={inputClass}
        />
      </Field>

      {/* Genre */}
      <Field label="Genre" hint="Select any that apply">
        <div className="flex flex-wrap gap-2 pt-1">
          {GENRES.map((g) => {
            const active = genres.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGenre(g)}
                className={`rounded-sm border px-3 py-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-stone-700 bg-stone-800 text-stone-50"
                    : "border-stone-300 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Description */}
      <Field label="Description" hint="Optional — a short blurb about the world">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Fog-covered streets, gas lamps, and secrets buried in the aristocracy…"
          rows={3}
          className={`${inputClass} resize-none leading-relaxed`}
        />
      </Field>

      {error && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-sm bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Project"}
        </button>
        <a
          href="/"
          className="rounded-sm border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none transition-colors";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium text-stone-700">
          {label}
          {required && <span className="ml-0.5 text-stone-400">*</span>}
        </label>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
