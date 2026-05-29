import { describe, expect, it } from 'vitest';
import { computeQuestChains, type ComputedQuestChain, type PrereqEdge } from './graph';

interface FixtureInput {
  ids: readonly number[];
  edges: ReadonlyArray<readonly [number, number]>;
  names?: Record<number, string>;
  parents?: Record<number, string | null>;
}

function build({ ids, edges, names, parents }: FixtureInput) {
  return {
    questIds: ids,
    edges: edges.map(([from, to]): PrereqEdge => ({ from, to })),
    questNames: new Map<number, string>(
      Object.entries(names ?? {}).map(([k, v]) => [Number(k), v]),
    ),
    questParents: new Map<number, string | null>(
      Object.entries(parents ?? {}).map(([k, v]) => [Number(k), v]),
    ),
  };
}

function memberMap(chain: ComputedQuestChain) {
  return new Map(chain.members.map((m) => [m.questId, m]));
}

describe('computeQuestChains', () => {
  it('emits no chains for isolated quests (size 1 dropped)', () => {
    const r = computeQuestChains(build({ ids: [1, 2, 3], edges: [] }));
    expect(r).toEqual([]);
  });

  it('linear chain marks every member critical (one root, one final)', () => {
    const r = computeQuestChains(
      build({ ids: [1, 2, 3], edges: [[1, 2], [2, 3]] }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('side branch is optional, main path is critical', () => {
    // A → B → C (main), A → D (side leaf at the same stage as B)
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [2, 3],
          [1, 4],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
      }),
    );
    expect(r).toHaveLength(1);
    const m = memberMap(r[0]);
    expect(m.get(1)?.isCritical).toBe(true); // A — on path
    expect(m.get(2)?.isCritical).toBe(true); // B — on path
    expect(m.get(3)?.isCritical).toBe(true); // C — the final quest
    expect(m.get(4)?.isCritical).toBe(false); // D — side branch
  });

  it('diamond keeps both parallel paths critical (any path to D is needed)', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
        ],
      }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('fully cyclic chain marks every member critical (no skippable quests)', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
          [3, 1],
        ],
      }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('multi-leaf tiebreak picks the lowest-id final (and marks the other leaf optional)', () => {
    // A → B, A → C — B and C are both leaves at stage 1.
    // Lowest-id leaf is B (id 2), so B is the final and C is optional.
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [1, 3],
        ],
      }),
    );
    const m = memberMap(r[0]);
    expect(m.get(1)?.isCritical).toBe(true); // root
    expect(m.get(2)?.isCritical).toBe(true); // final (lowest-id of B, C)
    expect(m.get(3)?.isCritical).toBe(false); // optional sibling
  });

  it('linear chain A → B → C', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C' },
        // Same parent across all members — under the parent-bounded
        // grouping, mixing parents would split the chain at the boundary.
        // This test focuses on the structural pass, so keep them together.
        parents: { 1: 'Tutorial', 2: 'Tutorial', 3: 'Tutorial' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.id).toBe(1);
    expect(c.representativeRootId).toBe(1);
    expect(c.size).toBe(3);
    expect(c.rootCount).toBe(1);
    expect(c.hasCycles).toBe(false);
    expect(c.cycleCount).toBe(0);
    expect(c.maxDepth).toBe(2);
    expect(c.name).toBe('A');
    expect(c.parent).toBe('Tutorial');
    const m = memberMap(c);
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(1);
    expect(m.get(3)?.depth).toBe(2);
    expect(m.get(1)?.isRoot).toBe(true);
    expect(m.get(2)?.isRoot).toBe(false);
    expect(m.get(3)?.isRoot).toBe(false);
    expect(c.edges).toHaveLength(2);
    expect(c.edges.every((e) => !e.inCycle)).toBe(true);
  });

  it('branching A → B, A → C', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [1, 3],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].rootCount).toBe(1);
    expect(r[0].maxDepth).toBe(1);
    const m = memberMap(r[0]);
    expect(m.get(2)?.depth).toBe(1);
    expect(m.get(3)?.depth).toBe(1);
  });

  it('diamond A → B, A → C, B → D, C → D — D collapses to one slot at depth 2', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(4);
    expect(c.hasCycles).toBe(false);
    expect(c.maxDepth).toBe(2);
    expect(memberMap(c).get(4)?.depth).toBe(2);
    // D appears only once, not twice (no duplicate members across paths).
    expect(c.members.filter((m) => m.questId === 4)).toHaveLength(1);
  });

  it('pure cycle A → B → C → A — no roots, fully cyclic name', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
          [3, 1],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.id).toBe(1);
    expect(c.rootCount).toBe(0);
    expect(c.hasCycles).toBe(true);
    expect(c.cycleCount).toBe(1);
    // Chain name is just the representative quest's name; cyclicity is an
    // attribute surfaced via `hasCycles`, not part of the identifier.
    expect(c.name).toBe('A');
    // Every quest at depth 0 (the lone condensation root SCC contains all of them).
    expect(c.members.every((m) => m.depth === 0)).toBe(true);
    // Every member has a non-null sccId pointing at the same cycle.
    expect(c.members.every((m) => m.sccId !== null)).toBe(true);
    const distinctScc = new Set(c.members.map((m) => m.sccId));
    expect(distinctScc.size).toBe(1);
    expect(c.edges.every((e) => e.inCycle)).toBe(true);
  });

  it('multi-root convergence — chop wood + gather water → go farming → beyond', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 3],
          [2, 3],
          [3, 4],
        ],
        names: { 1: 'Chop wood', 2: 'Gather water', 3: 'Go farming', 4: 'Beyond' },
        parents: { 1: 'Farming', 2: 'Farming', 3: 'Farming', 4: 'Farming' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(4);
    expect(c.rootCount).toBe(2);
    expect(c.id).toBe(1);
    expect(c.name).toBe('Chop wood');
    expect(c.parent).toBe('Farming');
    expect(c.maxDepth).toBe(2);
    const m = memberMap(c);
    expect(m.get(1)?.isRoot).toBe(true);
    expect(m.get(2)?.isRoot).toBe(true);
    expect(m.get(3)?.isRoot).toBe(false);
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(0);
    expect(m.get(3)?.depth).toBe(1);
    expect(m.get(4)?.depth).toBe(2);
  });

  it('disconnected components — two chains', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [3, 4],
        ],
      }),
    );
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe(1);
    expect(r[1].id).toBe(3);
    expect(r[0].size).toBe(2);
    expect(r[1].size).toBe(2);
  });

  it('self-loop A → A plus A → B — A flagged cyclic, B acyclic at depth 1', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2],
        edges: [
          [1, 1],
          [1, 2],
        ],
        names: { 1: 'A', 2: 'B' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(2);
    expect(c.hasCycles).toBe(true);
    expect(c.cycleCount).toBe(1);
    // A's self-loop makes it have incoming → not a "root" in the user sense.
    // Same for B (has incoming from A). So the chain has no strict roots,
    // but the name still falls through to the representative quest's name
    // — cyclicity is conveyed by `hasCycles`, not the chain name.
    expect(c.rootCount).toBe(0);
    expect(c.name).toBe('A');
    const m = memberMap(c);
    expect(m.get(1)?.sccId).not.toBeNull();
    expect(m.get(2)?.sccId).toBeNull();
    // Condensation has {A} → {B}, so depth assignment still works.
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(1);
    const selfLoop = c.edges.find((e) => e.fromQuestId === 1 && e.toQuestId === 1);
    expect(selfLoop?.inCycle).toBe(true);
    const cross = c.edges.find((e) => e.fromQuestId === 1 && e.toQuestId === 2);
    expect(cross?.inCycle).toBe(false);
  });

  it('ignores duplicate edges and unknown endpoints', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2],
        edges: [
          [1, 2],
          [1, 2],
          [99, 1],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].edges).toHaveLength(1);
  });

  describe('parent boundary', () => {
    it('splits chains at parent boundaries — hub edge becomes external', () => {
      // Hub quest A (parent="Hub") gates two unrelated storylines:
      //   * Maya's Concerns: M1 → M2 (parent="MayaC")
      //   * Maya's Collection: K1 → K2 (parent="MayaK")
      // Under pure-WCC grouping these would all merge into one mega-chain.
      // With parent-bounded grouping each storyline is its own chain, and
      // A→M1 / A→K1 surface as external prereqs on those chains.
      const r = computeQuestChains(
        build({
          ids: [1, 10, 11, 20, 21],
          edges: [
            [1, 10],
            [10, 11],
            [1, 20],
            [20, 21],
          ],
          names: {
            1: 'Hub',
            10: 'Maya Concerns 1',
            11: 'Maya Concerns 2',
            20: 'Maya Collection 1',
            21: 'Maya Collection 2',
          },
          parents: { 1: 'Hub', 10: 'MayaC', 11: 'MayaC', 20: 'MayaK', 21: 'MayaK' },
        }),
      );
      // Two real chains: MayaC and MayaK. The hub quest is alone in its
      // parent so it doesn't form a chain on its own.
      expect(r).toHaveLength(2);
      const byId = new Map(r.map((c) => [c.id, c]));
      const mayaC = byId.get(10)!;
      const mayaK = byId.get(20)!;
      expect(mayaC.size).toBe(2);
      expect(mayaK.size).toBe(2);

      // M1 has no in-chain prereq, so it's a root for its chain. But it
      // DOES have incoming from the hub, so it's not isRoot.
      expect(mayaC.members.find((m) => m.questId === 10)!.isRoot).toBe(false);
      expect(mayaK.members.find((m) => m.questId === 20)!.isRoot).toBe(false);
      // Each chain has zero starts because the hub gates entry.
      expect(mayaC.rootCount).toBe(0);
      expect(mayaK.rootCount).toBe(0);

      // External prereqs: each chain's first quest is "Unlocked by" the
      // hub. The hub isn't in any chain, so externalChainId is null.
      const mayaCIn = mayaC.externalEdges.filter((e) => e.direction === 'in');
      expect(mayaCIn).toEqual([
        { direction: 'in', internalQuestId: 10, externalQuestId: 1, externalChainId: null },
      ]);
      const mayaKIn = mayaK.externalEdges.filter((e) => e.direction === 'in');
      expect(mayaKIn).toEqual([
        { direction: 'in', internalQuestId: 20, externalQuestId: 1, externalChainId: null },
      ]);
    });

    it('cross-chain prereqs link both chains when both sides form chains', () => {
      // Chain A (parent="P1"): A1 → A2.
      // Chain B (parent="P2"): B1 → B2.
      // Cross-parent edge A2 → B1 — should NOT merge, but should appear
      // as "Unlocks" on chain A and "Unlocked by" on chain B with the
      // other chain's id filled in on both sides.
      const r = computeQuestChains(
        build({
          ids: [1, 2, 3, 4],
          edges: [
            [1, 2],
            [2, 3],
            [3, 4],
          ],
          parents: { 1: 'P1', 2: 'P1', 3: 'P2', 4: 'P2' },
        }),
      );
      expect(r).toHaveLength(2);
      const a = r.find((c) => c.id === 1)!;
      const b = r.find((c) => c.id === 3)!;
      expect(a.externalEdges).toContainEqual({
        direction: 'out',
        internalQuestId: 2,
        externalQuestId: 3,
        externalChainId: 3,
      });
      expect(b.externalEdges).toContainEqual({
        direction: 'in',
        internalQuestId: 3,
        externalQuestId: 2,
        externalChainId: 1,
      });
    });

    it('NULL-parent quests still group by WCC (fallback)', () => {
      // No parents set anywhere → behaves like pre-boundary WCC grouping.
      const r = computeQuestChains(
        build({
          ids: [1, 2, 3],
          edges: [
            [1, 2],
            [2, 3],
          ],
        }),
      );
      expect(r).toHaveLength(1);
      expect(r[0].size).toBe(3);
      expect(r[0].externalEdges).toEqual([]);
    });

    it('NULL parent does not merge with a named parent', () => {
      // Quest 1 has no parent; Quest 2 has parent="P1". Edge 1→2 must
      // stay external (different parent values, one null one not).
      const r = computeQuestChains(
        build({
          ids: [1, 2, 3],
          edges: [
            [1, 2],
            [2, 3],
          ],
          parents: { 2: 'P1', 3: 'P1' },
        }),
      );
      // Chain {2,3} with external prereq from quest 1.
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe(2);
      expect(r[0].size).toBe(2);
      expect(r[0].externalEdges).toContainEqual({
        direction: 'in',
        internalQuestId: 2,
        externalQuestId: 1,
        externalChainId: null,
      });
    });
  });
});
