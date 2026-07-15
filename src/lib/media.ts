/** Public URL for a file in the public `media` bucket. */
export function publicMediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/media/${storagePath}`;
}
