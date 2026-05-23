// Database layer.
//
// Public surface: types + a comlink-wrapped client that talks to the DB
// worker. The worker owns the SQLite-WASM engine and OPFS persistence.

export type {
  DatasetRecord,
  DbStatus,
  EquipRecord,
  GameDatabase,
  ItemRecord,
  MapRecord,
  MobRecord,
  NpcRecord,
  QuestRecord,
} from './types';
export { getDbClient, terminateDbClient } from './client';
