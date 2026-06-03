import type { PutObjectInput, StorageProvider } from "../types";

/**
 * Cloudflare R2 provider (S3-compatible). Env:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET, R2_PUBLIC_BASE_URL  (e.g. https://media.yourdomain.com)
 *
 * publicUrl works today (just needs R2_PUBLIC_BASE_URL). Write/sign ops need
 * SigV4 — finish by installing `aws4fetch` and completing the marked methods:
 *
 *   import { AwsClient } from "aws4fetch";
 *   const aws = new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" });
 *   const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
 *   await aws.fetch(endpoint, { method: "PUT", body, headers: { "content-type": contentType } });
 *
 * Kept dependency-free until R2 is actually adopted, so the rest of the app and
 * the Supabase provider need nothing extra.
 */

const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

function notImplemented(op: string): never {
  throw new Error(
    `R2 storage ${op} is not implemented yet. Install 'aws4fetch' and complete lib/storage/providers/r2.ts, ` +
    `then set STORAGE_PROVIDER=r2 with the R2_* env vars.`,
  );
}

export const r2Storage: StorageProvider = {
  name: "r2",

  async put(_input: PutObjectInput) {
    return notImplemented("put");
  },

  publicUrl(key: string) {
    if (!PUBLIC_BASE) throw new Error("R2_PUBLIC_BASE_URL is not set");
    return `${PUBLIC_BASE}/${key}`;
  },

  async signedUrl(_key: string, _expiresInSec?: number) {
    return notImplemented("signedUrl");
  },

  async remove(_key: string) {
    return notImplemented("remove");
  },
};
