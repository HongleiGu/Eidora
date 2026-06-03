"use client";

import { useState } from "react";
import Link from "next/link";
import Markdown from "./markdown";

export interface TreeEntity {
  type: string;
  slug: string;
  name: string;
  image?: string;
}

interface FullEntity {
  slug: string;
  name: string;
  entity_type: string;
  visibility: string;
  content: string | null;
  secrets: string | null;
  front_matter: Record<string, unknown> | null;
}

const FOLDERS: { type: string; label: string }[] = [
  { type: "character", label: "Characters" },
  { type: "location", label: "Locations" },
  { type: "artifact", label: "Artifacts" },
  { type: "lore", label: "Lore" },
  { type: "document", label: "Documents" },
  { type: "scenario", label: "Scenarios" },
];

const DOT: Record<string, string> = {
  character: "bg-amber-400", location: "bg-emerald-400", artifact: "bg-violet-400",
  lore: "bg-orange-400", document: "bg-sky-400", scenario: "bg-rose-400",
};

// EID-96: dragging src onto tgt sets a field on src, reusing existing front-matter.
function organizeAction(src: TreeEntity, tgt: TreeEntity): { field: string; message: string } | null {
  if (src.slug === tgt.slug && src.type === tgt.type) return null;
  if (src.type === "location" && tgt.type === "location") return { field: "parent", message: `${src.name} is now inside ${tgt.name}` };
  if (src.type === "character" && tgt.type === "location") return { field: "location", message: `${src.name} placed in ${tgt.name}` };
  if (src.type === "artifact" && tgt.type === "location") return { field: "location", message: `${src.name} placed in ${tgt.name}` };
  if (src.type === "artifact" && tgt.type === "character") return { field: "owner", message: `${tgt.name} now owns ${src.name}` };
  return null;
}

export default function WorkspaceExplorer({
  projectSlug,
  entities: initialEntities,
}: {
  projectSlug: string;
  entities: TreeEntity[];
}) {
  const [entities, setEntities] = useState<TreeEntity[]>(initialEntities);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<{ type: string; slug: string } | null>(null);
  const [entity, setEntity] = useState<FullEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragSrc, setDragSrc] = useState<TreeEntity | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const grouped = FOLDERS.map((f) => ({ ...f, items: entities.filter((e) => e.type === f.type) }));

  function toggle(type: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  async function open(type: string, slug: string) {
    setSelected({ type, slug });
    setLoading(true);
    setEntity(null);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/entities/${type}/${slug}`);
      if (res.ok) setEntity(await res.json() as FullEntity);
    } finally {
      setLoading(false);
    }
  }

  // GET current front_matter, merge a patch, PUT back. Returns merged front_matter.
  async function patchFrontMatter(type: string, slug: string, patch: Record<string, unknown>) {
    const getRes = await fetch(`/api/projects/${projectSlug}/entities/${type}/${slug}`);
    if (!getRes.ok) throw new Error("Could not load item");
    const cur = await getRes.json() as FullEntity;
    const merged = { ...(cur.front_matter ?? {}), ...patch };
    const putRes = await fetch(`/api/projects/${projectSlug}/entities/${type}/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ frontMatter: merged }),
    });
    if (!putRes.ok) throw new Error("Could not save");
    return merged;
  }

  async function handleOrganize(src: TreeEntity, tgt: TreeEntity) {
    const action = organizeAction(src, tgt);
    if (!action) { setStatus(`Can't place ${src.name} on ${tgt.name}`); return; }
    try {
      await patchFrontMatter(src.type, src.slug, { [action.field]: tgt.slug });
      setStatus(action.message);
      if (selected?.type === src.type && selected?.slug === src.slug) open(src.type, src.slug);
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  async function handleFileDrop(tgt: TreeEntity, file: File) {
    if (!file.type.startsWith("image/")) { setStatus("Only images can be dropped onto items."); return; }
    setStatus(`Uploading to ${tgt.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch(`/api/projects/${projectSlug}/assets`, { method: "POST", body: fd });
      if (!up.ok) throw new Error("Upload failed");
      const { url, key } = await up.json() as { url: string; key: string };
      await patchFrontMatter(tgt.type, tgt.slug, { image: url, imageKey: key });
      setEntities((prev) => prev.map((e) => (e.type === tgt.type && e.slug === tgt.slug ? { ...e, image: url } : e)));
      setStatus(`Image added to ${tgt.name}`);
      if (selected?.type === tgt.type && selected?.slug === tgt.slug) open(tgt.type, tgt.slug);
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  function onDrop(e: React.DragEvent, tgt: TreeEntity) {
    e.preventDefault();
    setDropKey(null);
    const file = e.dataTransfer.files?.[0];
    if (file) { handleFileDrop(tgt, file); return; }
    if (dragSrc) handleOrganize(dragSrc, tgt);
    setDragSrc(null);
  }

  const fm = (entity?.front_matter ?? {}) as Record<string, unknown>;
  const image = typeof fm.image === "string" ? fm.image : "";

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[260px_1fr] overflow-hidden">
      {/* Tree */}
      <aside className="flex flex-col overflow-hidden border-r border-stone-200 bg-white">
        <div className="flex-1 overflow-y-auto p-2">
          {grouped.map((g) => {
            const isCollapsed = collapsed.has(g.type);
            return (
              <div key={g.type} className="mb-0.5">
                <div className="flex items-center justify-between rounded-sm px-1.5 py-1 hover:bg-stone-50">
                  <button
                    onClick={() => toggle(g.type)}
                    className="flex flex-1 items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-stone-500"
                  >
                    <span className="inline-block w-3 text-stone-400">{isCollapsed ? "▸" : "▾"}</span>
                    {g.label}
                    <span className="text-stone-300">{g.items.length}</span>
                  </button>
                  <Link
                    href={`/projects/${projectSlug}/${g.type}/new`}
                    className="px-1 text-sm text-stone-300 hover:text-stone-600"
                    title={`New ${g.label.slice(0, -1)}`}
                  >
                    +
                  </Link>
                </div>

                {!isCollapsed && (
                  <ul className="ml-1">
                    {g.items.length === 0 && <li className="px-2 py-1 pl-6 text-xs text-stone-300">empty</li>}
                    {g.items.map((e) => {
                      const active = selected?.type === e.type && selected?.slug === e.slug;
                      const key = `${e.type}/${e.slug}`;
                      return (
                        <li key={e.slug}>
                          <button
                            draggable
                            onDragStart={() => setDragSrc(e)}
                            onDragEnd={() => { setDragSrc(null); setDropKey(null); }}
                            onDragOver={(ev) => { ev.preventDefault(); setDropKey(key); }}
                            onDragLeave={() => setDropKey((k) => (k === key ? null : k))}
                            onDrop={(ev) => onDrop(ev, e)}
                            onClick={() => open(e.type, e.slug)}
                            className={`flex w-full items-center gap-2 rounded-sm py-1 pl-6 pr-2 text-left text-sm transition-colors ${
                              active ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50"
                            } ${dropKey === key ? "ring-1 ring-stone-400 ring-inset bg-stone-50" : ""}`}
                          >
                            {e.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={e.image} alt="" className="h-4 w-4 shrink-0 rounded-xs object-cover" />
                            ) : (
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.type]}`} />
                            )}
                            <span className="truncate">{e.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* Status / hint footer */}
        <div className="border-t border-stone-100 px-3 py-2 text-xs text-stone-400">
          {status || "Drag items to link them · drop an image onto an item"}
        </div>
      </aside>

      {/* Content pane */}
      <main className="overflow-y-auto bg-[#faf8f5]">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-stone-400">
            <p className="font-display text-4xl text-stone-300">⌗</p>
            <p className="mt-3 text-sm">Select an item to view it.</p>
            <p className="mt-1 text-xs text-stone-300">Drag a character onto a location, or an image onto any item.</p>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">Loading…</div>
        ) : !entity ? (
          <div className="flex h-full items-center justify-center text-sm text-stone-400">Not found.</div>
        ) : (
          <div className="mx-auto max-w-2xl px-8 py-10">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${DOT[entity.entity_type]}`} />
                  <span className="text-xs uppercase tracking-wide text-stone-400">{entity.entity_type}</span>
                  {entity.visibility !== "public" && (
                    <span className="rounded-sm border border-stone-200 bg-white px-1.5 text-xs text-stone-500">
                      {entity.visibility === "gm_only" ? "GM" : "private"}
                    </span>
                  )}
                </div>
                <h1 className="font-display text-2xl font-semibold text-stone-900">{entity.name}</h1>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/projects/${projectSlug}/${entity.entity_type}/${entity.slug}/edit`}
                  className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/projects/${projectSlug}/${entity.entity_type}/${entity.slug}`}
                  className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
                >
                  Open ↗
                </Link>
              </div>
            </div>

            {image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={entity.name} className="mb-5 max-h-72 w-full rounded-sm border border-stone-200 object-cover" />
            )}

            {entity.content ? (
              <Markdown>{entity.content}</Markdown>
            ) : (
              <p className="text-sm italic text-stone-400">No description yet.</p>
            )}

            {entity.secrets && (
              <div className="mt-6 rounded-sm border border-dashed border-stone-300 bg-stone-50 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                  <span className="rounded-sm bg-stone-200 px-1 text-stone-600">GM</span> Secrets
                </p>
                <Markdown className="text-sm italic text-stone-700">{entity.secrets}</Markdown>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
