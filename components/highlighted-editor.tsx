"use client";

import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";

export interface EntityLite {
  type: string;
  slug: string;
  name: string;
}

export interface EditorHandle {
  /** Insert text at the current caret (or append if not focused). */
  insertAtCaret: (text: string) => void;
}

const TYPE_ALIASES = new Set(["char", "loc", "art", "lore", "doc", "scenario", "character", "location", "artifact", "document"]);

// Matches @slug, @type:slug, and {var.path}. The 'g' flag drives tokenisation.
const TOKEN_RE = /(@(?:[a-z]+:)?[a-z0-9][a-z0-9-]*)|(\{[a-z0-9_]+(?:[.-][a-z0-9_]+)*\})/gi;

// Active @mention being typed at the caret (no whitespace after @).
const ACTIVE_MENTION_RE = /@([a-z]*:)?([a-z0-9-]*)$/i;

interface Segment {
  text: string;
  kind: "plain" | "ref" | "ref-unknown" | "var";
}

function tokenize(text: string, knownSlugs: Set<string>): Segment[] {
  const segs: Segment[] = [];
  let last = 0;

  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index;
    if (idx > last) segs.push({ text: text.slice(last, idx), kind: "plain" });

    if (m[1]) {
      // @reference — strip optional type: prefix to get the slug
      const slug = m[1].includes(":") ? m[1].split(":")[1] : m[1].slice(1);
      segs.push({ text: m[0], kind: knownSlugs.has(slug) ? "ref" : "ref-unknown" });
    } else {
      segs.push({ text: m[0], kind: "var" });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), kind: "plain" });
  return segs;
}

const SEG_CLASS: Record<Segment["kind"], string> = {
  plain: "",
  ref: "rounded-sm bg-emerald-100 text-emerald-800",
  "ref-unknown": "rounded-sm bg-amber-100 text-amber-800",
  var: "rounded-sm bg-sky-100 text-sky-800",
};

const HighlightedEditor = forwardRef<EditorHandle, {
  value: string;
  onChange: (v: string) => void;
  entities: EntityLite[];
  placeholder?: string;
}>(function HighlightedEditor({ value, onChange, entities, placeholder }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    insertAtCaret(text: string) {
      const el = textareaRef.current;
      if (!el) { onChange(value + text); return; }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        const pos = start + text.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
  }), [value, onChange]);

  const knownSlugs = useMemo(() => new Set(entities.map((e) => e.slug)), [entities]);
  const segments = useMemo(() => tokenize(value, knownSlugs), [value, knownSlugs]);

  // ── @mention autocomplete ────────────────────────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return entities
      .filter((e) => e.slug.includes(q) || e.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, entities]);

  useEffect(() => setHighlightIdx(0), [mentionQuery]);

  function syncScroll() {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  function detectMention(el: HTMLTextAreaElement) {
    const upToCaret = el.value.slice(0, el.selectionStart);
    const m = ACTIVE_MENTION_RE.exec(upToCaret);
    // Only trigger for unscoped (@partial) or after a known alias prefix
    if (m && (!m[1] || TYPE_ALIASES.has(m[1].slice(0, -1)))) {
      setMentionQuery(m[2] ?? "");
    } else {
      setMentionQuery(null);
    }
  }

  function applyMention(slug: string) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = el.value.slice(0, caret);
    const after = el.value.slice(caret);
    const replaced = before.replace(ACTIVE_MENTION_RE, `@${slug} `);
    const newValue = replaced + after;
    onChange(newValue);
    setMentionQuery(null);
    // Restore caret just after the inserted mention
    requestAnimationFrame(() => {
      const pos = replaced.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx((i) => (i + 1) % suggestions.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setHighlightIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); applyMention(suggestions[highlightIdx].slug); return; }
      if (e.key === "Escape")    { e.preventDefault(); setMentionQuery(null); return; }
    }
  }

  return (
    <div className="relative h-full w-full">
      {/* Backdrop (highlight layer) */}
      <div
        ref={backdropRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap wrap-break-word p-6 font-mono text-sm leading-relaxed text-transparent"
      >
        {segments.map((seg, i) =>
          seg.kind === "plain" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <span key={i} className={SEG_CLASS[seg.kind]}>{seg.text}</span>
          ),
        )}
        {/* guard so trailing newline keeps caret aligned */}
        {"\n"}
      </div>

      {/* Textarea (transparent text, visible caret) */}
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          onChange(e.target.value);
          detectMention(e.target);
        }}
        onClick={(e) => detectMention(e.currentTarget)}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre-wrap wrap-break-word bg-transparent p-6 font-mono text-sm leading-relaxed text-stone-900 caret-stone-900 placeholder:text-stone-400 focus:outline-none"
      />

      {/* @mention command palette */}
      {mentionQuery !== null && suggestions.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-10 overflow-hidden rounded-sm border border-stone-200 bg-white shadow-lg">
          <p className="border-b border-stone-100 px-3 py-1.5 text-xs text-stone-400">
            Insert reference {mentionQuery && <span className="text-stone-500">· {mentionQuery}</span>}
          </p>
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${s.slug}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyMention(s.slug); }}
              onMouseEnter={() => setHighlightIdx(i)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                i === highlightIdx ? "bg-stone-100" : "hover:bg-stone-50"
              }`}
            >
              <span className="font-medium text-stone-800">{s.name}</span>
              <span className="text-xs text-stone-400">@{s.slug}</span>
              <span className="ml-auto text-xs capitalize text-stone-300">{s.type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

export default HighlightedEditor;
