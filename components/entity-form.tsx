"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImageUploadField from "./image-upload-field";

type EntityType = "character" | "location" | "artifact" | "lore" | "document" | "scenario";
type Visibility = "public" | "gm_only" | "author_only";

const TYPE_LABELS: Record<EntityType, string> = {
  character: "Character", location: "Location", artifact: "Artifact",
  lore: "Lore", document: "Document", scenario: "Scenario",
};

export interface EntityFormInitial {
  name?: string;
  visibility?: Visibility;
  content?: string;
  secrets?: string;
  frontMatter?: Record<string, unknown>;
}

export interface EntityFormProps {
  projectSlug: string;
  entityType: EntityType;
  mode: "create" | "edit";
  entitySlug?: string;
  initial?: EntityFormInitial;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none transition-colors";
export const selectClass = `${inputClass} cursor-pointer`;

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium text-stone-700">{label}</label>
        {hint && <span className="text-xs text-stone-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Type-specific field components ────────────────────────────────────────────

type FieldProps = { fm: Record<string, unknown>; set: (k: string, v: unknown) => void };

export function CharacterFields({ fm, set }: FieldProps) {
  const traits = (fm.traits as Record<string, unknown> | undefined) ?? {};
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Role">
          <select className={selectClass} value={String(fm.role ?? "")} onChange={(e) => set("role", e.target.value || undefined)}>
            <option value="">— none —</option>
            <option value="player_character">Player Character</option>
            <option value="npc">NPC</option>
            <option value="background">Background</option>
          </select>
        </Field>
        <Field label="Status">
          <select className={selectClass} value={String(fm.status ?? "")} onChange={(e) => set("status", e.target.value || undefined)}>
            <option value="">— none —</option>
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
            <option value="unknown">Unknown</option>
            <option value="missing">Missing</option>
          </select>
        </Field>
      </div>
      <Field label="Location" hint="Entity slug">
        <input className={inputClass} placeholder="oxford" value={String(fm.location ?? "")} onChange={(e) => set("location", e.target.value || undefined)} />
      </Field>
      <Field label="Faction(s)" hint="Comma-separated slugs">
        <input className={inputClass} placeholder="thames-valley-police" value={(fm.faction as string[] | undefined)?.join(", ") ?? ""} onChange={(e) => set("faction", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined)} />
      </Field>
      <Field label="Appearance">
        <input className={inputClass} placeholder="Mid-50s, rumpled coat, sad eyes" value={String(traits.appearance ?? "")} onChange={(e) => set("traits", { ...traits, appearance: e.target.value || undefined })} />
      </Field>
    </>
  );
}

export function LocationFields({ fm, set }: FieldProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <select className={selectClass} value={String(fm.locationType ?? "")} onChange={(e) => set("locationType", e.target.value || undefined)}>
            <option value="">— none —</option>
            {["continent","country","city","district","building","room","other"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Parent" hint="Containing location slug">
          <input className={inputClass} placeholder="grand-manor" value={String(fm.parent ?? "")} onChange={(e) => set("parent", e.target.value || undefined)} />
        </Field>
      </div>
      <Field label="Tags" hint="Comma-separated">
        <input className={inputClass} placeholder="crime-scene, locked-room" value={(fm.tags as string[] | undefined)?.join(", ") ?? ""} onChange={(e) => set("tags", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined)} />
      </Field>
    </>
  );
}

export function ArtifactFields({ fm, set }: FieldProps) {
  return (
    <>
      <Field label="Type">
        <select className={selectClass} value={String(fm.artifactType ?? "")} onChange={(e) => set("artifactType", e.target.value || undefined)}>
          <option value="">— none —</option>
          {["weapon","clue","document","treasure","prop"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Location" hint="Slug">
          <input className={inputClass} placeholder="locked-study" value={String(fm.location ?? "")} onChange={(e) => set("location", e.target.value || undefined)} />
        </Field>
        <Field label="Owner" hint="Character slug">
          <input className={inputClass} placeholder="lord-blackwood" value={String(fm.owner ?? "")} onChange={(e) => set("owner", e.target.value || undefined)} />
        </Field>
      </div>
    </>
  );
}

export function LoreFields({ fm, set }: FieldProps) {
  return (
    <>
      <Field label="Type">
        <select className={selectClass} value={String(fm.loreType ?? "")} onChange={(e) => set("loreType", e.target.value || undefined)}>
          <option value="">— none —</option>
          {["faction","event","creature","species","law","legend","rumor","custom"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Tags" hint="Comma-separated">
        <input className={inputClass} placeholder="supernatural, backstory" value={(fm.tags as string[] | undefined)?.join(", ") ?? ""} onChange={(e) => set("tags", e.target.value ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : undefined)} />
      </Field>
    </>
  );
}

export function DocumentFields({ fm, set }: FieldProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <select className={selectClass} value={String(fm.documentType ?? "")} onChange={(e) => set("documentType", e.target.value || undefined)}>
            <option value="">— none —</option>
            {["timeline","manuscript","map","letter","codex","newspaper","blueprint","custom"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Linked Scenario" hint="Slug">
          <input className={inputClass} placeholder="haunting-of-blackwood" value={String(fm.scenario ?? "")} onChange={(e) => set("scenario", e.target.value || undefined)} />
        </Field>
      </div>
    </>
  );
}

export function ScenarioFields({ fm, set }: FieldProps) {
  const game = (fm.game ?? {}) as Record<string, unknown>;
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Game Type">
          <select className={selectClass} value={String(fm.gameType ?? "")} onChange={(e) => set("gameType", e.target.value || undefined)}>
            <option value="">— none —</option>
            {["detective","turtle_soup","coc","story","sandbox"].map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="World" hint="Slug">
          <input className={inputClass} placeholder="victorian-london" value={String(fm.world ?? "")} onChange={(e) => set("world", e.target.value || undefined)} />
        </Field>
      </div>
      <Field label="Premise">
        <textarea className={`${inputClass} resize-none leading-relaxed`} rows={3} placeholder="Lord Blackwood was found dead in his locked study…" value={String(game.premise ?? "")} onChange={(e) => set("game", { ...game, premise: e.target.value || undefined })} />
      </Field>
    </>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function EntityForm({
  projectSlug,
  entityType,
  mode,
  entitySlug,
  initial = {},
}: EntityFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name ?? "");
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility ?? "public");
  const [content, setContent] = useState(initial.content ?? "");
  const [secrets, setSecrets] = useState(initial.secrets ?? "");
  const [fm, setFm] = useState<Record<string, unknown>>(initial.frontMatter ?? {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function setFmKey(k: string, v: unknown) {
    setFm((prev) =>
      v === undefined
        ? Object.fromEntries(Object.entries(prev).filter(([key]) => key !== k))
        : { ...prev, [k]: v }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setError("");
    setLoading(true);

    try {
      const isEdit = mode === "edit" && entitySlug;
      const url = isEdit
        ? `/api/projects/${projectSlug}/entities/${entityType}/${entitySlug}`
        : `/api/projects/${projectSlug}/entities`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entityType,
          name: name.trim(),
          visibility,
          content,
          secrets,
          frontMatter: fm,
        }),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Something went wrong.");
      }

      const data = await res.json() as { slug: string };
      router.push(`/projects/${projectSlug}/${entityType}/${data.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const fp = { fm, set: setFmKey };
  const cancelHref = mode === "edit" && entitySlug
    ? `/projects/${projectSlug}/${entityType}/${entitySlug}`
    : `/projects/${projectSlug}?type=${entityType}`;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Name + Visibility */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field label="Name" hint="*">
            <input
              className={inputClass}
              placeholder={entityType === "character" ? "Inspector Morse" : `New ${TYPE_LABELS[entityType]}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
        </div>
        <Field label="Visibility">
          <select className={selectClass} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
            <option value="public">Public</option>
            <option value="gm_only">GM Only</option>
            <option value="author_only">Author Only</option>
          </select>
        </Field>
      </div>

      {/* Image */}
      <ImageUploadField
        projectSlug={projectSlug}
        url={fm.image as string | undefined}
        imageKey={fm.imageKey as string | undefined}
        suggestedPrompt={name ? `${name} — ${entityType}` : ""}
        onChange={({ url, key }) => {
          setFmKey("image", url);
          setFmKey("imageKey", key);
        }}
      />

      {/* Reveal (play-time gate) */}
      <Field label="Reveal" hint="When players can see this during a session">
        <select
          className={selectClass}
          value={(fm.reveal as string) ?? "public"}
          onChange={(e) => setFmKey("reveal", e.target.value === "public" ? undefined : e.target.value)}
        >
          <option value="public">Public — visible from the start</option>
          <option value="secret">Secret — hidden until revealed by the GM</option>
        </select>
      </Field>

      {/* Type-specific fields */}
      {entityType === "character" && <CharacterFields {...fp} />}
      {entityType === "location"  && <LocationFields  {...fp} />}
      {entityType === "artifact"  && <ArtifactFields  {...fp} />}
      {entityType === "lore"      && <LoreFields       {...fp} />}
      {entityType === "document"  && <DocumentFields   {...fp} />}
      {entityType === "scenario"  && <ScenarioFields   {...fp} />}

      {/* Narrative */}
      <div className="border-t border-stone-100 pt-2">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-stone-400">Narrative</p>
        <Field label="Content" hint="Markdown supported">
          <textarea
            className={`${inputClass} resize-y leading-relaxed`}
            rows={6}
            placeholder="Write a description, backstory, or notes…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field>
      </div>

      {/* Secrets */}
      <Field label="Secrets" hint="GM / author only — never shown to players">
        <textarea
          className={`${inputClass} resize-y leading-relaxed border-dashed`}
          rows={3}
          placeholder="Hidden knowledge, true motives, solution…"
          value={secrets}
          onChange={(e) => setSecrets(e.target.value)}
        />
      </Field>

      {error && (
        <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-sm bg-stone-800 px-5 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-50"
        >
          {loading ? "Saving…" : mode === "edit" ? "Save Changes" : `Create ${TYPE_LABELS[entityType]}`}
        </button>
        <a
          href={cancelHref}
          className="rounded-sm border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
