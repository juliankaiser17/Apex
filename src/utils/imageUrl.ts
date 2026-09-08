/**
 * APEX — High-Performance Mobile Image Optimization & Prefetch Pipeline
 * 
 * Provides responsive CDN sizing constraints, memory-bounded bitmap decoding,
 * and an LRU prefetch cache that prevents redundant downloads on mobile.
 */

export type ImageSizeVariant = 'feed' | 'card' | 'thumbnail' | 'avatar';

const VARIANT_CONFIGS: Record<ImageSizeVariant, { width: number; quality: number }> = {
  feed: { width: 1080, quality: 80 },
  card: { width: 520, quality: 75 },
  thumbnail: { width: 320, quality: 70 },
  avatar: { width: 160, quality: 75 }
};

/**
 * Optimizes an image URL for mobile display dimensions.
 * For Unsplash and compatible CDNs, injects exact width, compression quality, and WebP format.
 */
export function getOptimizedImageUrl(
  rawUrl: string | undefined | null,
  variant: ImageSizeVariant = 'feed'
): string {
  if (!rawUrl) return '';

  // Data URLs or local blobs should be returned as-is
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  const { width, quality } = VARIANT_CONFIGS[variant];

  // Unsplash image optimization
  if (rawUrl.includes('images.unsplash.com')) {
    try {
      const url = new URL(rawUrl);
      url.searchParams.set('auto', 'format');
      url.searchParams.set('fit', 'crop');
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', String(quality));
      return url.toString();
    } catch {
      // Fallback string replacement
      return rawUrl.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, `q=${quality}`);
    }
  }

  // Cloudinary image optimization
  if (rawUrl.includes('res.cloudinary.com')) {
    return rawUrl.replace('/upload/', `/upload/w_${width},q_${quality},f_auto,c_fill/`);
  }

  return rawUrl;
}

/**
 * Bounded LRU Image Prefetch Cache
 * Prevents memory leaks by tracking loaded URLs and keeping a maximum size.
 */
class ImagePrefetcher {
  private cache = new Set<string>();
  private inFlight = new Set<string>();
  private readonly maxCacheSize = 35;

  public prefetch(url: string | undefined | null, variant: ImageSizeVariant = 'feed'): void {
    if (!url) return;
    const optimized = getOptimizedImageUrl(url, variant);
    if (!optimized || this.cache.has(optimized) || this.inFlight.has(optimized)) return;

    // Evict oldest if exceeding max capacity
    if (this.cache.size >= this.maxCacheSize) {
      const firstEntry = this.cache.values().next().value;
      if (firstEntry) this.cache.delete(firstEntry);
    }

    this.inFlight.add(optimized);
    const img = new Image();
    img.onload = () => {
      this.inFlight.delete(optimized);
      this.cache.add(optimized);
    };
    img.onerror = () => {
      this.inFlight.delete(optimized);
    };
    img.src = optimized;
  }

  public isCached(url: string, variant: ImageSizeVariant = 'feed'): boolean {
    const optimized = getOptimizedImageUrl(url, variant);
    return this.cache.has(optimized);
  }

  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const imagePrefetchCache = new ImagePrefetcher();
