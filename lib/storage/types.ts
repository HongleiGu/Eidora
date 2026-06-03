export type StorageProviderName = "supabase" | "r2";

export interface PutObjectInput {
  /** Provider-agnostic object key, e.g. "projects/<id>/<uuid>-portrait.jpg". */
  key: string;
  body: ArrayBuffer | Uint8Array | Blob;
  contentType: string;
}

export interface StorageProvider {
  readonly name: StorageProviderName;

  /** Upload an object. Returns the stored key. */
  put(input: PutObjectInput): Promise<{ key: string }>;

  /** Stable public URL for a key (assumes a public bucket/base). */
  publicUrl(key: string): string;

  /** Time-limited signed URL — use for gated/private content. */
  signedUrl(key: string, expiresInSec?: number): Promise<string>;

  /** Delete an object. No-op if it doesn't exist. */
  remove(key: string): Promise<void>;
}
