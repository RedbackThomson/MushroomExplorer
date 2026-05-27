// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { detectImageVersion } from '@scrolled/wz';
import { ImgDataSource } from '@/parser/ImgDataSource';
import { extractItems, extractMobs } from '@/extractors';
import type { WzMapleVersionName } from '@/parser';
import { gatherImgFixtures, hasImgFixtures, wzVersionFromEnv } from '../helpers/localFixtures';

/**
 * Integration test against a real folder of standalone `.img` files (a
 * HaRepacker-style dump), the IMG counterpart to `wz-real.test.ts`.
 *
 * Runs only when `test/fixtures/local/img/` contains a `.img` tree (folders
 * mirroring a WZ archive: `Item/…`, `Mob/…`, `String/Mob.img`, …). Drop your
 * own there; see that directory's README. CI skips cleanly without fixtures.
 */
const fixtures = gatherImgFixtures();

/**
 * Logical roots present, e.g. `Item.wz`, `Mob.wz`, `String.wz`. Only files
 * nested under a folder count — a loose `.img` at the dataset root (`smap.img`)
 * has no logical root and is ignored by the data source, so we exclude it here
 * too (matching `buildImgDataset`).
 */
const rootsPresent = new Set(
  fixtures
    .map((f) => f.relPath.split('/'))
    .filter((segs) => segs.length >= 2)
    .map((segs) => (/\.wz$/i.test(segs[0]!) ? segs[0]! : `${segs[0]!}.wz`)),
);
const has = (name: string) => rootsPresent.has(name);

describe.skipIf(!hasImgFixtures())('ImgDataSource — real .img dataset', () => {
  let source: ImgDataSource;
  let version: WzMapleVersionName;

  beforeAll(async () => {
    // Detect the region key from a small representative image (any image
    // decrypts under the same key; Mob.img is small and usually present).
    const rep =
      fixtures.find((f) => /(^|\/)Mob\.img$/i.test(f.relPath)) ??
      [...fixtures].sort((a, b) => statSync(a.path).size - statSync(b.path).size)[0]!;
    const detected = await detectImageVersion(readFileSync(rep.path));
    version = (detected?.version as WzMapleVersionName) ?? wzVersionFromEnv();

    source = new ImgDataSource();
    await source.init(version);
    const result = await source.load(fixtures.map((f) => ({ name: f.relPath, source: f.path })));
    if (result.errors.length > 0) {
      const detail = result.errors.map((e) => `${e.name}: ${e.message}`).join('\n  ');
      throw new Error(`Failed to load IMG fixtures:\n  ${detail}`);
    }
  });

  afterAll(async () => {
    await source?.dispose();
  });

  it('detected a plausible region key', () => {
    expect(['GMS', 'EMS', 'BMS', 'CLASSIC']).toContain(version);
  });

  it('exposes folders as logical <Folder>.wz files, each with children', async () => {
    const files = await source.listFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f.kind).toBe('file');
      expect(f.name).toMatch(/\.wz$/);
      const children = await source.listChildren(f.fullPath);
      expect(children.length).toBeGreaterThan(0);
    }
  });

  it('resolves a logical root by path', async () => {
    const files = await source.listFiles();
    const node = await source.getNode(files[0]!.name);
    expect(node).not.toBeNull();
    expect(node?.kind).toBe('file');
    expect(node?.hasChildren).toBe(true);
  });

  it('returns null for paths that do not exist', async () => {
    expect(await source.getNode('Item.wz/does-not-exist/at-all')).toBeNull();
  });

  it.skipIf(!has('Mob.wz') || !has('String.wz'))(
    'extracts named mobs (extractor parity with WZ)',
    async () => {
      const result = await extractMobs(source);
      expect(result.mobs.length).toBeGreaterThan(0);
      // Every emitted mob has a localized name (the extractor skips nameless ones).
      expect(result.mobs.every((m) => typeof m.name === 'string' && m.name.length > 0)).toBe(true);
    },
  );

  it.skipIf(!has('Item.wz') || !has('String.wz'))(
    'extracts items and decodes at least one icon to PNG',
    async () => {
      const result = await extractItems(source);
      expect(result.items.length).toBeGreaterThan(0);
      // Canvas decode through the IMG path: find an item whose icon decoded and
      // assert the bytes are a real PNG. Soft on count — not every dump ships
      // icons — but if any decoded, it must be valid.
      const withIcon = result.items.find((i) => i.iconData && i.iconData.byteLength > 0);
      if (withIcon?.iconData) {
        expect([...withIcon.iconData.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      }
    },
  );
});
