import type { GameDataSource } from '@/parser';
import type {
  QuestRecord,
  QuestRequirementRecord,
  QuestRewardRecord,
} from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-quests');

export interface ExtractQuestsResult {
  quests: QuestRecord[];
  requirements: QuestRequirementRecord[];
  rewards: QuestRewardRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Quest.wz` and emit normalized quest records.
 *
 * Source layout (v83 GMS / MapleRoyals):
 *
 *   Quest.wz/
 *     Check.img/<questId>/0/...   start requirements
 *     Check.img/<questId>/1/...   completion requirements
 *     Act.img/<questId>/0/...     start actions (rare; rewards skipped here)
 *     Act.img/<questId>/1/...     completion actions (rewards)
 *     QuestInfo.img/<questId>/... metadata (autoStart, area, etc.; mostly ignored)
 *
 *   String.wz/
 *     Quest.img/<questId>/name    display name
 *     Quest.img/<questId>/parent  area / chain
 *     Quest.img/<questId>/desc    blurb (sometimes missing)
 *
 * We iterate `Check.img` because that's the set of quests with playable
 * logic — quests in `QuestInfo.img` without a Check.img sibling are typically
 * legacy or cosmetic entries. Quests without a localized name in String.wz
 * are skipped so the UI never renders a nameless row.
 */
export async function extractQuests(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractQuestsResult> {
  const quests: QuestRecord[] = [];
  const requirements: QuestRequirementRecord[] = [];
  const rewards: QuestRewardRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const checkChildren = await source.listChildren('Quest.wz/Check.img');
  if (checkChildren.length === 0) {
    const top = await source.listChildren('Quest.wz');
    log.warn('Quest.wz/Check.img absent or empty', {
      questWzTopLevel: top.map((n) => `${n.name} (${n.kind})`),
      hint:
        top.length === 0
          ? 'Quest.wz appears to have failed to load — check parser.load errors.'
          : 'Quest.wz loaded but has no Check.img; layout may differ from v83.',
    });
    return { quests, requirements, rewards, skipped };
  }

  const total = checkChildren.length;
  log.info('discovery complete', { totalQuests: total });

  // Probe a few entries up front so a "0 quests extracted" outcome carries
  // enough breadcrumbs to diagnose. If String.wz/Quest.img has a different
  // shape (nested under chapters, different image name, etc.), this surfaces
  // it in the diagnostics report. The "probe-v2" tag is so we can tell
  // whether stale code is running after a Vite reload.
  const probeIds = checkChildren
    .filter((c) => /^\d+$/.test(c.name))
    .slice(0, 3)
    .map((c) => Number(c.name));
  for (const probeId of probeIds) {
    const nameNode = await source.getNode(`String.wz/Quest.img/${probeId}/name`);
    const containerNode = await source.getNode(`String.wz/Quest.img/${probeId}`);
    log.info('probe-v2 quest name', {
      id: probeId,
      stringPath: `String.wz/Quest.img/${probeId}/name`,
      nameKind: nameNode?.propertyKind ?? null,
      nameScalar: nameNode?.scalar ?? null,
      containerExists: !!containerNode,
      containerKind: containerNode?.kind ?? null,
      containerHasChildren: containerNode?.hasChildren ?? null,
    });
    if (containerNode?.hasChildren) {
      const containerChildren = await source.listChildren(
        `String.wz/Quest.img/${probeId}`,
      );
      log.info('probe-v2 quest container children', {
        id: probeId,
        sample: containerChildren
          .slice(0, 10)
          .map((c) => `${c.name}:${c.propertyKind ?? c.kind}`),
      });
    }
  }
  if (probeIds.length > 0) {
    const stringTop = await source.listChildren('String.wz/Quest.img');
    log.info('probe-v2 String.wz/Quest.img top-level', {
      total: stringTop.length,
      first: stringTop.slice(0, 12).map((n) => `${n.name}:${n.propertyKind ?? n.kind}`),
    });
  }

  let processed = 0;
  for (const entry of checkChildren) {
    const m = entry.name.match(/^(\d+)$/);
    if (!m) {
      processed += 1;
      continue;
    }
    const id = Number(m[1]);

    opts.onProgress?.({
      phase: 'Extracting quests',
      current: processed,
      total,
      detail: String(id),
    });

    const [nameNode, parentNode, descNode] = await Promise.all([
      source.getNode(`String.wz/Quest.img/${id}/name`),
      source.getNode(`String.wz/Quest.img/${id}/parent`),
      source.getNode(`String.wz/Quest.img/${id}/desc`),
    ]);
    const name = typeof nameNode?.scalar === 'string' && nameNode.scalar ? nameNode.scalar : null;
    if (!name) {
      skipped.push({ reason: 'no localized name', path: entry.fullPath });
      processed += 1;
      continue;
    }

    // -- Check.img/<id>/0 (start) ---------------------------------------
    const startPath = `${entry.fullPath}/0`;
    const [startNpcN, lvMinN, jobN] = await Promise.all([
      scalarNumber(source, `${startPath}/npc`),
      scalarNumber(source, `${startPath}/lvmin`),
      scalarNumber(source, `${startPath}/job`),
    ]);
    await collectQuestPrereqs(source, `${startPath}/quest`, id, requirements);
    if (lvMinN !== null) {
      requirements.push({ questId: id, kind: 'level', targetId: null, amount: lvMinN });
    }
    if (jobN !== null && jobN > 0) {
      requirements.push({ questId: id, kind: 'job', targetId: null, amount: jobN });
    }

    // -- Check.img/<id>/1 (completion) ----------------------------------
    const endPath = `${entry.fullPath}/1`;
    const endNpcN = await scalarNumber(source, `${endPath}/npc`);
    await collectItemReqs(source, `${endPath}/item`, id, requirements);
    await collectMobReqs(source, `${endPath}/mob`, id, requirements);

    // -- Act.img/<id>/1 (completion rewards) ----------------------------
    const actEndPath = `Quest.wz/Act.img/${id}/1`;
    const [expN, mesoN] = await Promise.all([
      scalarNumber(source, `${actEndPath}/exp`),
      // The game files use either `money` or `meso` depending on era.
      pickFirstNumber(source, [`${actEndPath}/money`, `${actEndPath}/meso`]),
    ]);
    if (expN !== null && expN !== 0) {
      rewards.push({ questId: id, kind: 'exp', targetId: null, amount: expN });
    }
    if (mesoN !== null && mesoN !== 0) {
      rewards.push({ questId: id, kind: 'meso', targetId: null, amount: mesoN });
    }
    await collectItemRewards(source, `${actEndPath}/item`, id, rewards);

    quests.push({
      id,
      name,
      parent: typeof parentNode?.scalar === 'string' ? parentNode.scalar : null,
      description: typeof descNode?.scalar === 'string' ? descNode.scalar : null,
      startNpcId: startNpcN,
      endNpcId: endNpcN,
      requiredLevel: lvMinN,
      requiredJob: jobN !== null && jobN > 0 ? jobN : null,
      sourcePath: entry.fullPath,
    });
    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting quests', current: processed, total });
  log.info('extraction complete', {
    quests: quests.length,
    requirements: requirements.length,
    rewards: rewards.length,
    skipped: skipped.length,
  });
  return { quests, requirements, rewards, skipped };
}

async function collectQuestPrereqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, stateNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/state`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(stateNode?.scalar);
    out.push({ questId, kind: 'questPre', targetId, amount });
  }
}

async function collectItemReqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, countNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    // Positive counts mean "must hand in N"; non-positive entries are flag
    // checks (own at least one) — store as amount=null in that case.
    out.push({ questId, kind: 'item', targetId, amount: amount && amount > 0 ? amount : null });
  }
}

async function collectMobReqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, countNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    out.push({ questId, kind: 'mob', targetId, amount });
  }
}

async function collectItemRewards(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRewardRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, countNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    // Negative counts in Act.img mean "consume" — those are really
    // requirements expressed in reward shape; skip here since the Check.img
    // pass already covered consumable requirements.
    if (amount !== null && amount < 0) continue;
    out.push({ questId, kind: 'item', targetId, amount });
  }
}

async function scalarNumber(source: GameDataSource, path: string): Promise<number | null> {
  const node = await source.getNode(path);
  return scalarToNumber(node?.scalar);
}

async function pickFirstNumber(source: GameDataSource, paths: string[]): Promise<number | null> {
  for (const p of paths) {
    const n = await scalarNumber(source, p);
    if (n !== null) return n;
  }
  return null;
}

function scalarToNumber(scalar: string | number | null | undefined): number | null {
  if (typeof scalar === 'number') return scalar;
  if (typeof scalar === 'string') {
    const n = Number(scalar);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
