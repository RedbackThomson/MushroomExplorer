// File-type classification for the wizard's drop zone.
//
// The drop zone accepts three kinds of input: WZ archives (a fresh/additive
// import), a folder of standalone `.img` files (the same, from an extracted
// dump), and a backup container for a full restore. A backup is a
// `.scrolled-backup` file or — for now — a bare `.sqlite`/`.sqlite3`/`.db` dump
// from before that format existed. This helper centralizes the by-extension
// decision so StepFiles and any future callers stay in agreement.

export type DroppedKind = 'wz' | 'img' | 'backup' | 'other';

/** A picked file plus its path relative to the dropped folder root. */
export interface RelFile {
  file: File;
  /** Slash-separated relative path; equals the file name for a flat drop. */
  relPath: string;
}

export function classify(relPath: string): DroppedKind {
  if (/\.img$/i.test(relPath)) return 'img';
  if (/\.wz$/i.test(relPath)) return 'wz';
  if (/\.scrolled-backup$/i.test(relPath) || /\.(sqlite3?|db)$/i.test(relPath)) return 'backup';
  return 'other';
}

export interface DropSplit {
  wz: File[];
  img: RelFile[];
  backup: File[];
  other: File[];
}

export function splitByKind(files: Iterable<RelFile>): DropSplit {
  const out: DropSplit = { wz: [], img: [], backup: [], other: [] };
  for (const rf of files) {
    const kind = classify(rf.relPath);
    if (kind === 'img') out.img.push(rf);
    else out[kind].push(rf.file);
  }
  return out;
}

// Recognized top-level WZ data folders. Used to normalize away whatever parent
// directory the user happened to select — `webkitRelativePath` prefixes every
// file with the picked folder's name, so `Item/…` may arrive as
// `ExtractedData/Item/…`. We re-root each path at the first recognized folder.
const WZ_ROOT_FOLDERS = new Set([
  'item',
  'character',
  'string',
  'mob',
  'npc',
  'map',
  'quest',
  'skill',
  'effect',
  'sound',
  'ui',
  'etc',
  'reactor',
  'morph',
  'tamingmob',
  'base',
]);

/** Drop any leading directories before the first recognized WZ root folder. */
export function normalizeImgRelPath(relPath: string): string {
  const segments = relPath.split('/').filter(Boolean);
  const idx = segments.findIndex((s) => WZ_ROOT_FOLDERS.has(s.replace(/\.wz$/i, '').toLowerCase()));
  return idx > 0 ? segments.slice(idx).join('/') : segments.join('/');
}

/** Overall kind of a drop. `'mixed'` (both WZ and IMG) is rejected upstream. */
export function datasetKind(split: DropSplit): 'wz' | 'img' | 'mixed' | 'none' {
  const hasWz = split.wz.length > 0;
  const hasImg = split.img.length > 0;
  if (hasWz && hasImg) return 'mixed';
  if (hasImg) return 'img';
  if (hasWz) return 'wz';
  return 'none';
}

/** Wrap plain `File`s as `RelFile`s using their names as relative paths. */
export function asRelFiles(files: Iterable<File>): RelFile[] {
  return Array.from(files, (file) => ({
    file,
    relPath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
  }));
}

/**
 * Recursively gather files from a drag-and-drop `DataTransfer`, preserving each
 * file's path relative to a dropped folder. Falls back to the flat file list
 * when the entries API is unavailable. `readEntries` returns at most 100 per
 * call, so each directory is drained in a loop.
 */
export async function gatherDropEntries(dt: DataTransfer): Promise<RelFile[]> {
  const items = Array.from(dt.items).filter((i) => i.kind === 'file');
  const entries = items
    .map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e != null);
  if (entries.length === 0) return asRelFiles(dt.files);

  const out: RelFile[] = [];
  await Promise.all(entries.map((e) => walkEntry(e, '', out)));
  return out;
}

async function walkEntry(entry: FileSystemEntry, prefix: string, out: RelFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    out.push({ file, relPath: prefix ? `${prefix}/${entry.name}` : entry.name });
    return;
  }
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
  for (;;) {
    const batch = await readEntries(reader);
    if (batch.length === 0) break;
    await Promise.all(batch.map((child) => walkEntry(child, childPrefix, out)));
  }
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}
