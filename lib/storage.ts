import { createClient } from "@/lib/supabase/client";

/**
 * Buckets that are public-read (their URLs work without a token). Everything
 * else is treated as private and accessed via short-lived signed URLs.
 * Keep in sync with the storage policies in supabase/migrations/0007_storage.sql
 * and 0010_photos_inspections.sql.
 */
export const PUBLIC_BUCKETS = new Set(["avatars", "property-photos"]);

export const isPublicBucket = (bucket: string) => PUBLIC_BUCKETS.has(bucket);

/** Default signed-URL lifetime for private files (1 hour). */
export const SIGNED_URL_TTL = 60 * 60;

/**
 * Resolve a displayable URL for a stored object path. Returns a public URL for
 * public buckets, or a freshly minted signed URL for private buckets. Call this
 * at render time for private files — signed URLs expire, so never persist them.
 */
export async function resolveStorageUrl(
  bucket: string,
  path: string,
  expiresIn: number = SIGNED_URL_TTL,
): Promise<string | null> {
  const supabase = createClient();
  if (PUBLIC_BUCKETS.has(bucket)) {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}
