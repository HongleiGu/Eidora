/**
 * Unified storage abstraction. Swap backends via STORAGE_PROVIDER env
 * (supabase | r2) — callers use getStorage() and never touch a vendor SDK.
 *
 *   import { getStorage, assetKey } from "@/lib/storage";
 *   const storage = getStorage();
 *   const { key } = await storage.put({ key: assetKey(projectId, filename), body, contentType });
 *   const url = storage.publicUrl(key);
 */
export type { StorageProvider, PutObjectInput, StorageProviderName } from "./types";

import { supabaseStorage } from "./providers/supabase";
import { r2Storage } from "./providers/r2";
import type { StorageProvider, StorageProviderName } from "./types";

export function getStorage(): StorageProvider {
  const name = (process.env.STORAGE_PROVIDER as StorageProviderName | undefined) ?? "supabase";
  switch (name) {
    case "supabase": return supabaseStorage;
    case "r2":       return r2Storage;
    default:         throw new Error(`Unknown STORAGE_PROVIDER: ${name}`);
  }
}

/** Sanitize a filename to a safe, lowercase form. */
function safeName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = (dot === -1 ? filename : filename.slice(0, dot)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
  const ext = dot === -1 ? "" : filename.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${base}${ext}`;
}

/** Build a collision-resistant, provider-agnostic key scoped to a project. */
export function assetKey(projectId: string, filename: string): string {
  return `projects/${projectId}/${crypto.randomUUID()}-${safeName(filename)}`;
}
