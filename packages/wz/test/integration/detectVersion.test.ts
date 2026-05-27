// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectVersion } from '../../src';

const __dirname = dirname(fileURLToPath(import.meta.url));
// We share the apps/web WZ fixtures dir — these binaries are gitignored.
const FIXTURES_DIR = resolve(__dirname, '../../../../apps/web/test/fixtures/wz');

const SAMPLES = ['String.wz', 'Item.wz', 'Mob.wz'];
const present = SAMPLES.filter((n) => existsSync(resolve(FIXTURES_DIR, n)));

describe.skipIf(present.length === 0)('detectVersion against real fixtures', () => {
  it.each(present)('identifies %s as a GMS-IV file (MapleRoyals v83)', async (name) => {
    const buf = await readFile(resolve(FIXTURES_DIR, name));
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const result = await detectVersion(bytes);
    expect(result).not.toBeNull();
    // MapleRoyals fixtures should report GMS encryption + v83 patch.
    expect(result?.version).toBe('GMS');
    expect(result?.mapleVersion).toBe(83);
    expect(result?.score).toBeGreaterThanOrEqual(0.9);
  });
});

describe.skipIf(present.length > 0)('detectVersion — fixtures not present', () => {
  it('reports the test was skipped because no fixtures were available', () => {
    expect(present.length).toBe(0);
  });
});
