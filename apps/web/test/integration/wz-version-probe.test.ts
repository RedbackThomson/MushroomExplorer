// @vitest-environment node
//
// Cycles through WzMapleVersion options to find the one that yields readable
// names from the MapleRoyals files. Disabled unless MGE_VERSION_PROBE=1.
import { describe, it } from 'vitest';
import { WzFile, WzMapleVersion, WzFileParseStatus } from '@tybys/wz';
import { getLocalFixture } from '../helpers/localFixtures';

const enabled = process.env.MGE_VERSION_PROBE === '1';

const VERSIONS: { name: string; v: WzMapleVersion }[] = [
  { name: 'GMS', v: WzMapleVersion.GMS },
  { name: 'EMS', v: WzMapleVersion.EMS },
  { name: 'BMS', v: WzMapleVersion.BMS },
  { name: 'CLASSIC', v: WzMapleVersion.CLASSIC },
];

describe.skipIf(!enabled)('WZ version probe', () => {
  it('tries each WzMapleVersion against String.wz', async () => {
    const fixture = getLocalFixture('String.wz');
    if (!fixture) throw new Error('String.wz missing');

    for (const { name, v } of VERSIONS) {
      const file = new WzFile(fixture.path, v);
      try {
        const status = await file.parseWzFile();
        if (status !== WzFileParseStatus.SUCCESS) {
          console.log(`${name}: status ${status}`);
          file.dispose();
          continue;
        }
        const root = file.wzDirectory;
        const firstNames: string[] = [];
        if (root) {
          for (const d of root.wzDirectories) firstNames.push(`dir:${d.name}`);
          for (const img of root.wzImages) firstNames.push(`img:${img.name}`);
          if (firstNames.length >= 8) break;
        }
        console.log(`${name}: first names →`, firstNames.slice(0, 8));
      } catch (e) {
        console.log(`${name}: threw ${(e as Error).message}`);
      } finally {
        file.dispose();
      }
    }
  });
});
