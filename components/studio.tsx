"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import HighlightedEditor, { type EditorHandle, type EntityLite } from "./highlighted-editor";
import StudioChat from "./studio-chat";

const TYPE_ORDER = ["character", "location", "artifact", "lore", "document", "scenario"] as const;

const TYPE_LABELS: Record<string, string> = {
  character: "Characters", location: "Locations", artifact: "Artifacts",
  lore: "Lore", document: "Documents", scenario: "Scenarios",
};

const DOT_COLORS: Record<string, string> = {
  character: "bg-amber-400", location: "bg-emerald-400", artifact: "bg-violet-400",
  lore: "bg-orange-400", document: "bg-sky-400", scenario: "bg-rose-400",
};

export default function Studio({
  projectSlug,
  projectName,
  entities,
}: {
  projectSlug: string;
  projectName: string;
  entities: EntityLite[];
}) {
  const [draft, setDraft] = useState("");
  const editorRef = useRef<EditorHandle>(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: entities.filter((e) => e.type === type),
  })).filter((g) => g.items.length > 0);

  function insertRef(slug: string) {
    editorRef.current?.insertAtCaret(`@${slug} `);
  }

  function insertFromChat(text: string) {
    editorRef.current?.insertAtCaret(`\n\n${text}\n`);
  }

  return (
    <div className="flex h-screen flex-col bg-[#faf8f5]">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-[#faf8f5] px-5 py-3">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${projectSlug}`} className="text-sm text-stone-500 hover:text-stone-700">
            ← {projectName}
          </Link>
          <span className="font-display text-lg font-semibold tracking-wide text-stone-800">Studio</span>
        </div>
        <p className="text-xs text-stone-400">
          <span className="rounded-sm bg-emerald-50 px-1 text-emerald-700">@ref</span>{" "}
          <span className="rounded-sm bg-sky-50 px-1 text-sky-700">{"{var}"}</span> supported
        </p>
      </header>

      {/* 3-pane body */}
      <div className="grid flex-1 grid-cols-[220px_1fr_380px] overflow-hidden">
        {/* Entity sidebar */}
        <aside className="overflow-y-auto border-r border-stone-200 bg-white">
          <div className="p-3">
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-stone-400">
              Entities
            </p>
            {grouped.length === 0 && (
              <p className="px-1 py-4 text-xs text-stone-400">
                No entities yet. Create some from the project page.
              </p>
            )}
            {grouped.map((g) => (
              <div key={g.type} className="mb-4">
                <p className="mb-1 px-1 text-xs font-medium text-stone-500">{TYPE_LABELS[g.type]}</p>
                <ul>
                  {g.items.map((e) => (
                    <li key={e.slug}>
                      <button
                        onClick={() => insertRef(e.slug)}
                        title={`Insert @${e.slug}`}
                        className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm text-stone-700 transition-colors hover:bg-stone-100"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[g.type]}`} />
                        <span className="truncate">{e.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Editor */}
        <section className="overflow-hidden bg-white">
          <HighlightedEditor
            ref={editorRef}
            value={draft}
            onChange={setDraft}
            entities={entities}
            placeholder="Begin your story or scenario here…&#10;&#10;Type @ to reference a character, location, or artifact.&#10;Use {world.era} or {char.slug.field} for variables."
          />
        </section>

        {/* Chat */}
        <section className="overflow-hidden border-l border-stone-200">
          <StudioChat
            projectSlug={projectSlug}
            getEditorText={() => draftRef.current}
            onInsert={insertFromChat}
          />
        </section>
      </div>
    </div>
  );
}
