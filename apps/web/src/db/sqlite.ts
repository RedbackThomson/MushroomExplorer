// Thin wrapper around `@sqlite.org/sqlite-wasm` that opens an OPFS-backed
// database with an in-memory fallback. Runs migrations on open and exposes a
// small typed surface for the worker to use.

import sqlite3InitModule, {
  type Database,
  type SqlValue,
  type BindingSpec,
  type Sqlite3Static,
} from '@sqlite.org/sqlite-wasm';

import { MIGRATIONS } from './migrations';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('db-sqlite');

export type Row = Record<string, SqlValue>;
export type Backend = 'opfs' | 'memory';

export interface OpenResult {
  backend: Backend;
  schemaVersion: number;
}

export class Sqlite {
  private sqlite3: Sqlite3Static | null = null;
  private db: Database | null = null;
  private _backend: Backend = 'memory';

  get backend(): Backend {
    return this._backend;
  }

  async open(): Promise<OpenResult> {
    if (this.db) {
      return { backend: this._backend, schemaVersion: this.currentSchemaVersion() };
    }

    log.info('initializing sqlite3 module');
    this.sqlite3 = await sqlite3InitModule();
    log.info('sqlite3 ready', { version: this.sqlite3.version.libVersion });

    const opfsCapabilities = await probeOpfsCapabilities();
    log.info('opfs capability probe', opfsCapabilities);

    try {
      const pool = await this.sqlite3.installOpfsSAHPoolVfs({ name: 'mge-db-pool' });
      this.db = new pool.OpfsSAHPoolDb('/mge.sqlite3');
      this._backend = 'opfs';
      log.info('opened OPFS-backed database', {
        path: '/mge.sqlite3',
        capacity: pool.getCapacity(),
        fileCount: pool.getFileCount(),
      });
    } catch (err) {
      log.warn('OPFS unavailable; using in-memory database (will not persist)', {
        ...describeError(err),
        capabilities: opfsCapabilities,
      });
      this.db = new this.sqlite3.oo1.DB(':memory:', 'ct');
      this._backend = 'memory';
    }

    this.db.exec('PRAGMA foreign_keys = ON;');
    this.runMigrations();

    const version = this.currentSchemaVersion();
    log.info('database open', { backend: this._backend, schemaVersion: version });
    return { backend: this._backend, schemaVersion: version };
  }

  /** Execute a one-shot statement (DDL or write). */
  exec(sql: string, bind?: BindingSpec): void {
    this.require().exec({ sql, bind });
  }

  /** Run a query and return all rows as plain objects. */
  selectObjects<T extends Row = Row>(sql: string, bind?: BindingSpec): T[] {
    return this.require().selectObjects(sql, bind) as T[];
  }

  /** Run a query expected to return at most one row. */
  selectObject<T extends Row = Row>(sql: string, bind?: BindingSpec): T | null {
    const row = this.require().selectObject(sql, bind) as T | undefined;
    return row ?? null;
  }

  /** Run a query expected to return a single scalar. */
  selectValue<T extends SqlValue = SqlValue>(sql: string, bind?: BindingSpec): T | null {
    const value = this.require().selectValue(sql, bind);
    return (value ?? null) as T | null;
  }

  /** Wrap `fn` in a transaction. Throws if anything inside throws. */
  transaction<T>(fn: () => T): T {
    const db = this.require();
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // best effort
      }
      throw e;
    }
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // best effort
      }
      this.db = null;
    }
  }

  // -- migrations ------------------------------------------------------------

  private currentSchemaVersion(): number {
    if (!this.db) return 0;
    try {
      const v = this.db.selectValue('SELECT MAX(version) FROM _migrations');
      return typeof v === 'number' ? v : 0;
    } catch {
      return 0;
    }
  }

  private runMigrations(): void {
    const db = this.require();
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version    INTEGER PRIMARY KEY,
        name       TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      );
    `);

    const applied = new Set(
      db.selectObjects('SELECT version FROM _migrations').map((r) => Number(r.version)),
    );

    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      log.info('applying migration', { version: m.version, name: m.name });
      this.transaction(() => {
        db.exec(m.sql);
        db.exec({
          sql: 'INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
          bind: [m.version, m.name, Date.now()],
        });
      });
    }
  }

  private require(): Database {
    if (!this.db) throw new Error('[mge] sqlite database not open');
    return this.db;
  }
}

interface OpfsCapabilities {
  hasNavigatorStorage: boolean;
  hasGetDirectory: boolean;
  hasFileSystemSyncAccessHandle: boolean;
  isSecureContext: boolean;
  origin: string | null;
  rootDirectoryError: string | null;
}

/**
 * Best-effort detection of why OPFS might be unavailable. Surfaced via the
 * diagnostics log alongside the actual install error.
 */
async function probeOpfsCapabilities(): Promise<OpfsCapabilities> {
  const g = globalThis as {
    navigator?: { storage?: { getDirectory?: () => Promise<unknown> } };
    isSecureContext?: boolean;
    origin?: string;
    FileSystemSyncAccessHandle?: unknown;
  };
  const out: OpfsCapabilities = {
    hasNavigatorStorage: !!g.navigator?.storage,
    hasGetDirectory: typeof g.navigator?.storage?.getDirectory === 'function',
    hasFileSystemSyncAccessHandle: typeof g.FileSystemSyncAccessHandle === 'function',
    isSecureContext: g.isSecureContext === true,
    origin: g.origin ?? null,
    rootDirectoryError: null,
  };
  if (out.hasGetDirectory) {
    try {
      await g.navigator!.storage!.getDirectory!();
    } catch (e) {
      out.rootDirectoryError = (e as Error).message ?? String(e);
    }
  }
  return out;
}
