// File-type classification for the wizard's drop zone.
//
// The wizard's drop zone accepts two kinds of input: WZ files for a fresh /
// additive import, and backup files for a full restore. A backup is a
// `.scrolled-backup` container or — for now — a bare `.sqlite`/`.sqlite3`/`.db`
// dump from before that format existed. This helper centralizes the
// by-extension decision so StepFiles and any future callers stay in agreement.

export type DroppedKind = 'wz' | 'backup' | 'other';

export function classify(name: string): DroppedKind {
  if (/\.wz$/i.test(name)) return 'wz';
  if (/\.scrolled-backup$/i.test(name) || /\.(sqlite3?|db)$/i.test(name)) return 'backup';
  return 'other';
}

export interface DropSplit {
  wz: File[];
  backup: File[];
  other: File[];
}

export function splitByKind(files: Iterable<File>): DropSplit {
  const out: DropSplit = { wz: [], backup: [], other: [] };
  for (const f of files) {
    const kind = classify(f.name);
    out[kind].push(f);
  }
  return out;
}
