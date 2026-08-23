/**
 * Real content-derived image hashing for replay/duplicate-submission detection.
 *
 * record_car_scan() in supabase/schema.sql rejects a scan when it sees the same
 * p_image_hash from the same user twice — but that check is only as good as the hash
 * itself. It previously received `hash_${Date.now()}_${make}_${model}`, which is a
 * timestamp + text string, not derived from the photo at all — every call produces a
 * different value, so the dedup check could never actually fire. This computes a real
 * SHA-256 digest of the photo's own bytes, so submitting the exact same photo twice
 * genuinely produces the exact same hash.
 */
export async function hashImageContent(imageUrlOrDataUrl: string): Promise<string> {
  try {
    const base64 = imageUrlOrDataUrl.includes(',')
      ? imageUrlOrDataUrl.split(',')[1]
      : null;

    if (base64 && typeof crypto !== 'undefined' && crypto.subtle) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return `sha256_${hex}`;
    }
  } catch (e) {
    console.warn('Image content hashing failed, falling back to URL-derived hash:', e);
  }

  // Fallback path — only reached for non-data-URL images (e.g. the offline/demo stock
  // photo fallback, which isn't a real captured scan anyway) or if Web Crypto is
  // unavailable. Still content-derived (hash of the URL string itself, not the clock),
  // so identical fallback images still collide correctly, unlike the old Date.now() scheme.
  let h = 0;
  for (let i = 0; i < imageUrlOrDataUrl.length; i++) {
    h = (Math.imul(31, h) + imageUrlOrDataUrl.charCodeAt(i)) | 0;
  }
  return `fallback_${(h >>> 0).toString(16)}`;
}
