"use client";

import { useState } from "react";
import ElementSuggester from "./element-suggester";

export default function SuggestButton({
  projectSlug,
  defaultType,
}: {
  projectSlug: string;
  defaultType?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
        title="Let the AI suggest a new element that fits your world"
      >
        ✨ Suggest
      </button>
      {open && <ElementSuggester projectSlug={projectSlug} defaultType={defaultType} onClose={() => setOpen(false)} />}
    </>
  );
}
