"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Markdown from "./markdown";

interface LogEntry { role: string; content: string }
export interface DiscoveredEntity { type: string; slug: string; name: string; image?: string; content?: string }
export interface GmEntity { type: string; slug: string; name: string; secret: boolean; revealed: boolean }

const DOT: Record<string, string> = {
  character: "bg-amber-400", location: "bg-emerald-400", artifact: "bg-violet-400",
  lore: "bg-orange-400", document: "bg-sky-400", scenario: "bg-rose-400",
};

export default function PlaySession({
  projectSlug,
  sessionId,
  scenarioName,
  premise,
  initialLog,
  initialDiscovered,
  initialEnded,
  initialOutcome,
  canGm,
  solution,
  gmEntities,
}: {
  projectSlug: string;
  sessionId: string;
  scenarioName: string;
  premise: string;
  initialLog: LogEntry[];
  initialDiscovered: DiscoveredEntity[];
  initialEnded: boolean;
  initialOutcome?: string;
  canGm: boolean;
  solution: string;
  gmEntities: GmEntity[];
}) {
  const [log, setLog] = useState<LogEntry[]>(initialLog);
  const [discovered, setDiscovered] = useState<DiscoveredEntity[]>(initialDiscovered);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(initialEnded);
  const [outcome, setOutcome] = useState<string | null>(initialOutcome ?? null);
  const [error, setError] = useState("");
  const [gmOpen, setGmOpen] = useState(false);
  const [gm, setGm] = useState<GmEntity[]>(gmEntities);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refreshDiscovered() {
    const d = await fetch(`/api/projects/${projectSlug}/play/${sessionId}/discovered`);
    if (d.ok) setDiscovered(await d.json() as DiscoveredEntity[]);
  }

  async function toggleReveal(e: GmEntity) {
    const next = !e.revealed;
    setGm((list) => list.map((x) => (x.type === e.type && x.slug === e.slug ? { ...x, revealed: next } : x)));
    const res = await fetch(`/api/projects/${projectSlug}/play/${sessionId}/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: e.type, slug: e.slug, reveal: next }),
    });
    if (res.ok) refreshDiscovered();
    else setGm((list) => list.map((x) => (x.type === e.type && x.slug === e.slug ? { ...x, revealed: !next } : x)));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [log, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy || ended) return;
    setInput("");
    setError("");
    setLog((l) => [...l, { role: "player", content: text }, { role: "agent", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectSlug}/play/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) {
        const b = await res.json().catch(() => ({ error: "The GM is unavailable." }));
        throw new Error((b as { error?: string }).error ?? "The GM is unavailable.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let revealed = false;

      const appendDelta = (delta: string) =>
        setLog((l) => {
          const copy = [...l];
          copy[copy.length - 1] = { role: "agent", content: copy[copy.length - 1].content + delta };
          return copy;
        });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith("data: ")) continue;
          const e = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | { type: "done"; result: { actions: { action: { type: string }; ok: boolean }[]; ended: boolean; outcome?: string } }
            | { type: "error"; error: string };
          if (e.type === "delta") appendDelta(e.text);
          else if (e.type === "error") throw new Error(e.error);
          else if (e.type === "done") {
            if (e.result.ended) { setEnded(true); setOutcome(e.result.outcome ?? "ended"); }
            revealed = e.result.actions.some((a) => a.ok && a.action.type === "reveal");
          }
        }
      }
      if (revealed) await refreshDiscovered();
    } catch (err) {
      setError((err as Error).message);
      // drop the optimistic player + empty agent messages on failure
      setLog((l) => l.slice(0, -2));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[1fr_280px] overflow-hidden">
      {/* Chat */}
      <div className="flex flex-col overflow-hidden">
        <div ref={scrollRef} className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-6 py-6">
          {/* Premise intro */}
          <div className="rounded-sm border border-stone-200 bg-white p-5 paper">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-400">{scenarioName}</p>
            <p className="mt-2 font-display text-base leading-relaxed text-stone-700">{premise}</p>
          </div>

          {log.map((m, i) => (
            <div key={i} className={m.role === "player" ? "flex justify-end" : ""}>
              {m.role === "player" ? (
                <div className="max-w-[85%] rounded-sm bg-stone-800 px-3 py-2 text-sm leading-relaxed text-stone-50">
                  {m.content}
                </div>
              ) : m.content ? (
                <div className="max-w-full"><Markdown>{m.content}</Markdown></div>
              ) : null}
            </div>
          ))}

          {busy && log[log.length - 1]?.content === "" && (
            <p className="font-display text-base italic text-stone-400">The GM considers…</p>
          )}
          {ended && (
            <div className="rounded-sm border border-stone-300 bg-stone-100 p-5 text-center">
              <p className="font-display text-xl font-medium text-stone-700">
                The End{outcome ? ` — ${outcome}` : ""}
              </p>
              <p className="mt-1 text-xs text-stone-400">The full transcript above is saved. You can revisit it anytime.</p>
              <Link
                href={`/projects/${projectSlug}/play`}
                className="mt-4 inline-block rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
              >
                ▶ Start a new session
              </Link>
            </div>
          )}
          {error && <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {/* Input */}
        <div className="border-t border-stone-200 p-3">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={ended ? "This session has ended." : "What do you do?  (Enter to act)"}
              rows={2}
              disabled={busy || ended}
              className="flex-1 resize-none rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={busy || ended || !input.trim()}
              className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700 disabled:opacity-40"
            >
              {busy ? "…" : "Act"}
            </button>
          </div>
        </div>
      </div>

      {/* Discovered panel */}
      <aside className="overflow-y-auto border-l border-stone-200 bg-white p-4">
        {canGm && (
          <div className="mb-4 rounded-sm border border-stone-200 bg-stone-50">
            <button
              onClick={() => setGmOpen((o) => !o)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider text-stone-500"
            >
              <span>⚙ GM tools</span>
              <span className="text-stone-400">{gmOpen ? "▾" : "▸"}</span>
            </button>
            {gmOpen && (
              <div className="border-t border-stone-200 p-3">
                {solution && (
                  <div className="mb-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-400">Solution</p>
                    <p className="whitespace-pre-wrap text-xs italic leading-relaxed text-stone-600">{solution}</p>
                  </div>
                )}
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-400">Reveal entities</p>
                <ul className="space-y-1">
                  {gm.map((e) => (
                    <li key={`${e.type}:${e.slug}`} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleReveal(e)}
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-xs border text-[10px] ${
                          e.revealed ? "border-emerald-400 bg-emerald-400 text-white" : "border-stone-300 bg-white text-transparent"
                        }`}
                        title={e.revealed ? "Hide from player" : "Reveal to player"}
                      >
                        ✓
                      </button>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.type] ?? "bg-stone-400"}`} />
                      <span className="truncate text-xs text-stone-700">{e.name}</span>
                      {e.secret && <span className="ml-auto shrink-0 text-[10px] text-purple-500">🔒</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-400">Discovered</p>
        {discovered.length === 0 ? (
          <p className="text-xs text-stone-400">Nothing yet. Explore and the GM will reveal what you find.</p>
        ) : (
          <ul className="space-y-3">
            {discovered.map((e) => (
              <li key={`${e.type}:${e.slug}`} className="rounded-sm border border-stone-100 p-2">
                <div className="flex items-center gap-2">
                  {e.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.image} alt="" className="h-6 w-6 shrink-0 rounded-xs object-cover" />
                  ) : (
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.type] ?? "bg-stone-400"}`} />
                  )}
                  <span className="text-sm font-medium text-stone-800">{e.name}</span>
                </div>
                {e.content && <p className="mt-1 text-xs leading-relaxed text-stone-500">{e.content}</p>}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
