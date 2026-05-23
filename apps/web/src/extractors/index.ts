// Extractor layer.
//
// Consumes a GameDataSource (the parser-layer interface), produces normalized
// domain records validated by Zod. Pure functions where practical. No React,
// no SQLite, no I/O beyond the GameDataSource methods.
//
// Implementations land in Phases 3–5 (items/equips → mobs/npcs/maps → quests).

import type { GameDataSource } from '@/parser';

export interface Extractor<T> {
  extract(source: GameDataSource): Promise<T[]>;
}
