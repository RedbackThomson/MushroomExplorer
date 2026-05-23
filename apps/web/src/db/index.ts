// Database layer.
//
// Owns the SQLite-WASM engine, schema, migrations, and query helpers.
// Hides the storage engine behind a stable read/write API so the UI never
// imports the engine directly.
//
// Implementation lands in Phase 2 (storage layer).

export interface GameDatabase {
  ready: Promise<void>;
  // Read/write API will be defined in Phase 2.
}
