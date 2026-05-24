// Region / IV auto-detection.
//
// WZ files don't carry a region identifier in their header. The original
// HaSuite approach is to try each candidate IV, decrypt a known structure,
// and score the result by how "printable ASCII" the decoded bytes look —
// the IV that yields the most readable directory wins.
//
// Our scoring target is the root directory's child names: when the right
// IV is paired with a valid versionHash, those names are short ASCII tokens
// like "Eqp.img" / "Mob.wz". A wrong IV (or wrong versionHash) either fails
// to parse the directory at all (`readDirectory` throws on type-byte
// validation) or produces strings full of high-bit garbage.

import { Reader } from '../io/Reader';
import { getKeystream } from '../crypto/keystream';
import { readHeader } from './header';
import { findVersionCandidates } from './versionHash';
import { readDirectory } from './directory';
import type { WzVersion } from '../types';

/**
 * Candidates we try, in priority order. `MSEA` shares the EMS IV so we
 * don't probe it separately. `CLASSIC` shares the zero IV with `BMS`; we
 * report `BMS` since both decode identically.
 */
const CANDIDATE_VERSIONS: WzVersion[] = ['GMS', 'EMS', 'BMS'];

export interface DetectVersionResult {
  version: WzVersion;
  mapleVersion: number;
  versionHash: number;
  /** Fraction of root child name bytes that are printable ASCII (0..1). */
  score: number;
}

export interface DetectVersionOptions {
  /**
   * Max MapleStory patch version to probe per IV. Default 1000 — comfortably
   * above any released client; the inner loop also short-circuits as soon
   * as a candidate yields a parseable root directory.
   */
  maxMapleVersion?: number;
  /**
   * Minimum printable-ASCII score for a positive ID. Detection returns
   * `null` if no candidate clears this bar. Default 0.85 (entry names are
   * short and almost entirely letters/digits/dots when the IV is right).
   */
  minScore?: number;
}

/**
 * Detect the encryption variant of a WZ file by trial-decrypting its root
 * directory. Returns `null` if no candidate IV produces a confidently-
 * readable directory — the caller should treat that as "unknown" and ask
 * the user to specify the version manually.
 *
 * Async because building the AES keystream uses WebCrypto. The keystream
 * builder caches per-version, so repeated calls (e.g. across files in the
 * same dataset) are cheap.
 */
export async function detectVersion(
  bytes: Uint8Array,
  opts: DetectVersionOptions = {},
): Promise<DetectVersionResult | null> {
  const maxMapleVersion = opts.maxMapleVersion ?? 1000;
  const minScore = opts.minScore ?? 0.85;

  const header = readHeader(new Reader(bytes));

  let best: DetectVersionResult | null = null;
  for (const version of CANDIDATE_VERSIONS) {
    const keystream = await getKeystream(version, 256 * 1024);
    const candidates = findVersionCandidates(header.encVersion, maxMapleVersion);
    // v83 first (most common in MapleRoyals-era datasets).
    const ordered = [
      ...candidates.filter((c) => c.mapleVersion === 83),
      ...candidates.filter((c) => c.mapleVersion !== 83),
    ];
    for (const cand of ordered) {
      try {
        const root = readDirectory({
          reader: new Reader(bytes, header.dataStart + 2),
          header,
          versionHash: cand.hash,
          keystream,
        });
        if (root.children.length === 0) continue;
        const score = scorePrintability(root.children.map((c) => c.name));
        if (!best || score > best.score) {
          best = {
            version,
            mapleVersion: cand.mapleVersion,
            versionHash: cand.hash,
            score,
          };
        }
        // First parseable candidate for this IV is enough — moving on to
        // the next IV. Different MapleStory patches for the same IV will
        // all score similarly on the root directory.
        break;
      } catch {
        // Wrong IV/hash combo — readDirectory threw on a sanity check.
        // Try the next candidate.
      }
    }
  }

  if (!best || best.score < minScore) return null;
  return best;
}

function scorePrintability(names: string[]): number {
  let total = 0;
  let printable = 0;
  for (const name of names) {
    for (let i = 0; i < name.length; i++) {
      total += 1;
      const c = name.charCodeAt(i);
      if (c >= 0x20 && c <= 0x7e) printable += 1;
    }
  }
  return total === 0 ? 0 : printable / total;
}
