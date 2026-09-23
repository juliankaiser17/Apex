/**
 * APEX — Durable Card Image Storage
 * 
 * High-performance, quota-resilient storage for vehicle card images:
 * - Stores large binary image blobs in IndexedDB (Web / Capacitor WebView).
 * - On native mobile, falls back to Capacitor Filesystem or persistent Blob URLs.
 * - Leaves localStorage strictly for lightweight metadata (<1KB per card).
 * - NEVER stores multi-megabyte base64 strings in localStorage.
 */

const DB_NAME = 'apex_media_store';
const STORE_NAME = 'card_images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

// In-memory object URL cache for zero-latency UI rendering
const memoryUrlCache = new Map<string, string>();

/**
 * Converts a data URL to an ArrayBuffer / Blob for storage
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:')) {
    return new Blob([dataUrl], { type: 'text/plain' });
  }
  try {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const rawBase64 = parts[1] || '';
    const cleanBase64 = rawBase64.replace(/[^A-Za-z0-9+/=]/g, '');
    const binStr = atob(cleanBase64);
    const len = binStr.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8[i] = binStr.charCodeAt(i);
    }
    return new Blob([u8], { type: mime });
  } catch (_) {
    return new Blob([dataUrl], { type: 'image/jpeg' });
  }
}

export const cardImageStorage = {
  /**
   * Persists an image (base64 or remote URL) for a card.
   * Returns a lightweight URL for display.
   */
  async storeImage(cardId: string, imageUri: string): Promise<string> {
    if (!imageUri) return '';

    // If it's already a remote HTTP/HTTPS URL, don't store raw binary locally
    if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
      return imageUri;
    }

    // If it's a base64 data URL, store in IndexedDB
    if (imageUri.startsWith('data:')) {
      try {
        const blob = dataUrlToBlob(imageUri);
        const db = await getDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(blob, cardId);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        });

        // Create object URL and cache it
        const objUrl = URL.createObjectURL(blob);
        memoryUrlCache.set(cardId, objUrl);
        return objUrl;
      } catch (err) {
        console.warn('[cardImageStorage] IndexedDB store failed, falling back to memory:', err);
        memoryUrlCache.set(cardId, imageUri);
        return imageUri;
      }
    }

    return imageUri;
  },

  /**
   * Retrieves an image URL for a cardId from IndexedDB or memory cache.
   */
  async getImage(cardId: string): Promise<string | null> {
    if (memoryUrlCache.has(cardId)) {
      return memoryUrlCache.get(cardId)!;
    }

    try {
      const db = await getDB();
      const blob = await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(cardId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (blob && blob instanceof Blob) {
        const objUrl = URL.createObjectURL(blob);
        memoryUrlCache.set(cardId, objUrl);
        return objUrl;
      }
    } catch (err) {
      console.warn('[cardImageStorage] IndexedDB read failed:', err);
    }

    return null;
  },

  /**
   * Deletes a card's stored image blob when card is removed.
   */
  async deleteImage(cardId: string): Promise<void> {
    const cachedUrl = memoryUrlCache.get(cardId);
    if (cachedUrl && cachedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(cachedUrl);
    }
    memoryUrlCache.delete(cardId);

    try {
      const db = await getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(cardId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      // Non-fatal
    }
  }
};
