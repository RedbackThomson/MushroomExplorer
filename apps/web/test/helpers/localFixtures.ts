import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WzMapleVersionName } from '@/parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../fixtures/local');

export interface LocalFixture {
  name: string;
  path: string;
}

const VALID_VERSIONS = new Set<WzMapleVersionName>(['BMS', 'GMS', 'EMS', 'CLASSIC']);

export function wzVersionFromEnv(): WzMapleVersionName {
  const raw = process.env.MUSHEX_WZ_VERSION?.toUpperCase() as WzMapleVersionName | undefined;
  // MapleRoyals (v83-era client) uses the "old GMS" WZ encryption.
  if (!raw) return 'GMS';
  if (!VALID_VERSIONS.has(raw)) throw new Error(`Unknown MUSHEX_WZ_VERSION=${raw}`);
  return raw;
}

export function getLocalFixture(name: string): LocalFixture | null {
  const path = resolve(FIXTURES_DIR, name);
  if (!existsSync(path)) return null;
  return { name, path };
}

export function requireLocalFixture(name: string): LocalFixture {
  const fixture = getLocalFixture(name);
  if (!fixture) {
    throw new Error(
      `Missing local fixture: ${name}\n` +
        `Drop the file in apps/web/test/fixtures/local/ to run this test.\n` +
        `See that directory's README for details.`,
    );
  }
  return fixture;
}

/**
 * Returns true when the file is available. Tests use this with `it.skipIf(...)`
 * so CI stays green without proprietary fixtures.
 */
export function hasLocalFixture(name: string): boolean {
  return getLocalFixture(name) !== null;
}
