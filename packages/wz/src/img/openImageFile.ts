import { Reader } from '../io/Reader';
import { readImage } from './readImage';
import type { WzProperty } from './property';

/**
 * A standalone (HaRepacker-style) `.img` file: a serialized WZ image body with
 * no surrounding PKG1 archive header. The image starts at byte 0, so every
 * string-offset and canvas `dataOffset` reference inside it resolves relative
 * to byte 0 of these bytes.
 *
 * The `{ bytes, keystream }` pair is exactly what the canvas decoder and UOL
 * resolver read off a `WzFile`, so the same helpers work against a single
 * `.img` unchanged.
 */
export interface ImageFile {
  readonly bytes: Uint8Array;
  readonly keystream: Uint8Array;
  readonly properties: WzProperty[];
  readonly isLua: boolean;
}

/**
 * Parse a standalone `.img` byte buffer into its property tree. Throws if the
 * bytes aren't a WZ image body decodable with `keystream` (e.g. wrong region
 * key — the `"Property"` tag won't match).
 */
export function openImageFile(bytes: Uint8Array, keystream: Uint8Array): ImageFile {
  const parsed = readImage({ reader: new Reader(bytes), imageOffset: 0, keystream });
  return { bytes, keystream, properties: parsed.properties, isLua: parsed.isLua };
}
