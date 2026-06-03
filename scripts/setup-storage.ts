/**
 * Create the media storage bucket (idempotent).
 * Run: pnpm tsx --env-file=.env scripts/setup-storage.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = `https://${process.env.SUPABASE_URL}`;
const svc = process.env.SUPABASE_SERVICE_ROLE!;
const bucket = process.env.STORAGE_BUCKET ?? "media";
const admin = createClient(url, svc, { auth: { persistSession: false } });

(async () => {
  const { data: existing } = await admin.storage.getBucket(bucket);
  if (existing) {
    console.log(`Bucket "${bucket}" already exists (public: ${existing.public}).`);
    return;
  }

  const { error } = await admin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "25MB",
    allowedMimeTypes: ["image/*", "audio/*", "application/pdf"],
  });
  if (error) { console.error(`Failed to create bucket: ${error.message}`); process.exit(1); }
  console.log(`Created public bucket "${bucket}".`);
})();
