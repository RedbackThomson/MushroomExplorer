// Tiny helpers used by the export buttons. Kept in one place so JSON
// and raw-bytes downloads stay consistent and the call sites stay clean.

export function downloadJson(filename: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2);
  downloadBlob(filename, new Blob([text], { type: 'application/json' }));
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime: string): void {
  // The TS dom typing wants `BlobPart` with a backing ArrayBuffer; at
  // runtime our Uint8Array does have one. Cast at the boundary so we
  // don't have to convince TS for every call site.
  downloadBlob(filename, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** "Boss Drops" → "boss-drops". Falls back to "collection" so we never
 *  ship an empty filename. */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'collection';
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
