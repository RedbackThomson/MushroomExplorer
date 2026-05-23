import { useEffect, useState } from 'react';
import { getParserClient } from '@/parser';

/**
 * LRU cache of decoded icon object URLs keyed by WZ path. Bounded to ~256
 * entries; oldest entries are revoked and dropped first.
 */
const CACHE_LIMIT = 256;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

function touch(path: string, url: string) {
  if (cache.has(path)) {
    cache.delete(path);
  } else if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      const stale = cache.get(oldest);
      if (stale) URL.revokeObjectURL(stale);
      cache.delete(oldest);
    }
  }
  cache.set(path, url);
}

async function fetchIcon(path: string): Promise<string | null> {
  let p = pending.get(path);
  if (!p) {
    p = (async () => {
      const cached = cache.get(path);
      if (cached) return cached;
      const bytes = await getParserClient().getIconPng(path);
      if (!bytes) return null;
      // Copy into a fresh ArrayBuffer so the Blob type matches BlobPart even
      // when the source is a Uint8Array<SharedArrayBuffer>.
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      touch(path, url);
      return url;
    })().finally(() => {
      pending.delete(path);
    });
    pending.set(path, p);
  }
  return p;
}

/**
 * Look up a WZ icon and return an object-URL suitable for use in `<img src>`.
 * Returns `null` while loading or if the icon couldn't be decoded.
 *
 * The cache survives across components, so revisiting an item page doesn't
 * re-decode. Object URLs are revoked when evicted from the cache.
 */
export function useIcon(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => (path ? (cache.get(path) ?? null) : null));

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(null);
    fetchIcon(path).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
