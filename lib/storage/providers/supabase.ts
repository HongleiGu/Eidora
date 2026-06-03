import { createAdminClient } from "../../supabase/admin";
import type { PutObjectInput, StorageProvider } from "../types";

const BUCKET = process.env.STORAGE_BUCKET ?? "media";

/**
 * Supabase Storage provider. Uses the service-role (admin) client for writes;
 * the calling API route is responsible for authorizing the request first.
 */
export const supabaseStorage: StorageProvider = {
  name: "supabase",

  async put({ key, body, contentType }: PutObjectInput) {
    const db = createAdminClient();
    const { error } = await db.storage.from(BUCKET).upload(key, body, {
      contentType,
      upsert: true,
    });
    if (error) throw new Error(`Supabase storage upload: ${error.message}`);
    return { key };
  },

  publicUrl(key: string) {
    const db = createAdminClient();
    return db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  },

  async signedUrl(key: string, expiresInSec = 3600) {
    const db = createAdminClient();
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(key, expiresInSec);
    if (error) throw new Error(`Supabase storage signed url: ${error.message}`);
    return data.signedUrl;
  },

  async remove(key: string) {
    const db = createAdminClient();
    const { error } = await db.storage.from(BUCKET).remove([key]);
    if (error) throw new Error(`Supabase storage remove: ${error.message}`);
  },
};
