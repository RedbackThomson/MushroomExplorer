// Region / IV auto-detection for standalone `.img` files.
//
// A standalone `.img` has no PKG1 header and no encrypted version field, so
// `detectVersion` (which brute-forces a patch version from the header) doesn't
// apply. But the strings inside are still XOR-masked with a region keystream
// (or an all-zero one if dumped unencrypted, i.e. BMS/CLASSIC). We recover the
// region the same way HaSuite does for archives: trial-parse under each
// candidate keystream and keep the one that decodes to readable ASCII.
//
// A wrong keystream makes the leading `"Property"` tag mismatch, so `readImage`
// throws outright — strong signal. The printability score over deeper tokens
// is a secondary guard against a fluke parse.

import { Reader } from '../io/Reader';
import { getKeystream } from '../crypto/keystream';
import { readImage } from './readImage';
import { scorePrintability } from '../file/detectVersion';
import type { WzProperty } from './property';
import type { WzVersion } from '../types';

/**
 * Candidates we try, in priority order. `MSEA` shares the EMS IV; `CLASSIC`
 * shares the zero IV with `BMS`. We report `BMS` for the unencrypted case.
 */
const CANDIDATE_VERSIONS: WzVersion[] = ['GMS', 'EMS', 'BMS'];

export interface DetectImageVersionResult {
  version: WzVersion;
  /** Fraction of decoded tokens that are printable ASCII (0..1). */
  score: number;
}

export interface DetectImageVersionOptions {
  /**
   * Minimum printable-ASCII score for a positive ID. Returns `null` if no
   * candidate clears this bar. Default 0.85.
   */
  minScore?: number;
}

/**
 * Detect the encryption region of a standalone `.img` by trial-decrypting it
 * under each candidate keystream. Pass a small, representative image (e.g.
 * `String/Mob.img`). Returns `null` if nothing decodes confidently — the
 * caller should treat that as "unknown" and ask the user.
 */
export async function detectImageVersion(
  bytes: Uint8Array,
  opts: DetectImageVersionOptions = {},
): Promise<DetectImageVersionResult | null> {
  const minScore = opts.minScore ?? 0.85;

  let best: DetectImageVersionResult | null = null;
  for (const version of CANDIDATE_VERSIONS) {
    const keystream = await getKeystream(version, 256 * 1024);
    try {
      const parsed = readImage({ reader: new Reader(bytes), imageOffset: 0, keystream });
      const tokens = collectTokens(parsed.properties, 2);
      if (tokens.length === 0) continue;
      const score = scorePrintability(tokens);
      if (!best || score > best.score) best = { version, score };
    } catch {
      // Wrong region key — the "Property" tag (or a string leaf) didn't
      // decode. Try the next candidate.
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

/** Collect property names and string-leaf values down to `depth` levels. */
function collectTokens(props: WzProperty[], depth: number): string[] {
  const out: string[] = [];
  for (const p of props) {
    out.push(p.name);
    if (p.type === 'string') out.push(p.value);
    if (depth > 0 && (p.type === 'sub' || p.type === 'convex' || p.type === 'canvas')) {
      out.push(...collectTokens((p as { children: WzProperty[] }).children, depth - 1));
    }
  }
  return out;
}
