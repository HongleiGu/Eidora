"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteEntityBtn({
  projectSlug,
  entityType,
  entitySlug,
}: {
  projectSlug: string;
  entityType: string;
  entitySlug: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/projects/${projectSlug}/entities/${entityType}/${entitySlug}`, {
      method: "DELETE",
    });
    router.push(`/projects/${projectSlug}?type=${entityType}`);
    router.refresh();
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-500">Delete permanently?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-sm bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="rounded-sm border border-stone-200 px-4 py-2 text-sm font-medium text-stone-400 transition-colors hover:border-red-200 hover:text-red-500"
    >
      Delete
    </button>
  );
}
