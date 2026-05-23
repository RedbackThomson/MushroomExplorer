import type { GameDataSource, WzNodeInfo } from '@/parser';
import type { EquipRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-equips');

export interface ExtractEquipsResult {
  equips: EquipRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Phase 3 light pass: pull equipment names and slot/category from
 * `String.wz/Eqp.img/Eqp/<slot>/<id>`. Stat blocks (attack, defense,
 * job/level requirements, upgrade slots…) live in `Character.wz`, which is
 * ~800 MB and not yet supported by the in-memory load path. When that lands,
 * extend this extractor to populate the empty stat columns.
 *
 * Progress: discovery first (count ids per slot), then determinate progress
 * with `current / total` and the slot + id in the detail line.
 */
export async function extractEquips(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractEquipsResult> {
  const equips: EquipRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const eqpRoot = 'String.wz/Eqp.img/Eqp';
  const slots = await source.listChildren(eqpRoot);
  if (slots.length === 0) {
    log.debug('Eqp.img/Eqp empty or absent', { path: eqpRoot });
    return { equips, skipped };
  }

  // Discovery -------------------------------------------------------------
  const work: { slot: WzNodeInfo; entries: WzNodeInfo[] }[] = [];
  let total = 0;
  for (const slot of slots) {
    if (!slot.hasChildren) continue;
    opts.onProgress?.({
      phase: 'Discovering equips',
      current: total,
      detail: slot.name,
    });
    const entries = await source.listChildren(slot.fullPath);
    const idEntries = entries.filter((e) => /^\d+$/.test(e.name));
    work.push({ slot, entries: idEntries });
    total += idEntries.length;
  }
  log.info('discovery complete', { totalEquips: total, slots: work.length });

  // Extraction ------------------------------------------------------------
  let processed = 0;
  for (const { slot, entries } of work) {
    const slotKey = slot.name.toLowerCase();
    for (const entry of entries) {
      const id = Number(entry.name);
      opts.onProgress?.({
        phase: 'Extracting equips',
        current: processed,
        total,
        detail: `${slot.name} · ${id}`,
      });
      const nameNode = await source.getNode(`${entry.fullPath}/name`);
      const descNode = await source.getNode(`${entry.fullPath}/desc`);
      if (typeof nameNode?.scalar !== 'string' || !nameNode.scalar) {
        skipped.push({ reason: 'no name', path: entry.fullPath });
        processed += 1;
        continue;
      }
      equips.push({
        id,
        name: nameNode.scalar,
        description: typeof descNode?.scalar === 'string' ? descNode.scalar : null,
        slot: slotKey,
        category: slotKey,
        requiredLevel: null,
        requiredStr: null,
        requiredDex: null,
        requiredInt: null,
        requiredLuk: null,
        requiredJob: null,
        attack: null,
        magicAttack: null,
        defense: null,
        magicDefense: null,
        accuracy: null,
        avoidability: null,
        upgradeSlots: null,
        // Equip icons live in Character.wz which isn't loaded yet; leave both
        // null until that extractor lands.
        iconPath: null,
        iconData: null,
        sourcePath: entry.fullPath,
      });
      processed += 1;
    }
  }
  opts.onProgress?.({ phase: 'Extracting equips', current: processed, total });

  log.info('equip extraction complete', { count: equips.length, skipped: skipped.length });
  return { equips, skipped };
}
