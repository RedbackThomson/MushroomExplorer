// Extractor layer.
//
// Consumes a RawWzTree, produces normalized domain records validated by Zod.
// Pure functions where practical. No React, no SQLite, no I/O.
//
// Implementations land in Phases 3–5 (items/equips → mobs/npcs/maps → quests).

import type { RawWzTree } from '@/parser';

export interface Extractor<T> {
  extract(tree: RawWzTree): Promise<T[]>;
}
