// Domain query helpers built on top of the thin `Sqlite` wrapper.
//
// Phase 2 surface: items CRUD, datasets, status, clear-all. Extractors in
// Phase 3+ will add equip/mob/npc/map/quest helpers alongside these.

import type { Sqlite, Row } from './sqlite';
import type { DatasetRecord, DbStatus, ItemRecord, GameDatabase } from './types';

interface ItemRow extends Row {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  icon_path: string | null;
  price: number | null;
  stack_size: number | null;
  required_level: number | null;
  source_path: string;
}

function rowToItem(r: ItemRow): ItemRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    subcategory: r.subcategory,
    iconPath: r.icon_path,
    price: r.price,
    stackSize: r.stack_size,
    requiredLevel: r.required_level,
    sourcePath: r.source_path,
  };
}

export class DbApi implements GameDatabase {
  constructor(private readonly sql: Sqlite) {}

  async open(): Promise<DbStatus> {
    await this.sql.open();
    return this.status();
  }

  async status(): Promise<DbStatus> {
    const schemaVersion = Number(this.sql.selectValue('SELECT MAX(version) FROM _migrations') ?? 0);
    return {
      schemaVersion,
      backend: this.sql.backend,
      counts: {
        items: this.countOf('items'),
        equips: this.countOf('equips'),
        mobs: this.countOf('mobs'),
        npcs: this.countOf('npcs'),
        maps: this.countOf('maps'),
        quests: this.countOf('quests'),
        datasets: this.countOf('datasets'),
      },
    };
  }

  async upsertItem(item: ItemRecord): Promise<void> {
    this.upsertItemRow(item);
  }

  async upsertItems(items: ItemRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const item of items) this.upsertItemRow(item);
    });
    return items.length;
  }

  async getItem(id: number): Promise<ItemRecord | null> {
    const row = this.sql.selectObject<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
    return row ? rowToItem(row) : null;
  }

  async listItems(opts: { limit?: number; search?: string } = {}): Promise<ItemRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 1000);
    if (opts.search && opts.search.trim()) {
      const q = `%${opts.search.trim()}%`;
      return this.sql
        .selectObjects<ItemRow>('SELECT * FROM items WHERE name LIKE ? ORDER BY name LIMIT ?', [
          q,
          limit,
        ])
        .map(rowToItem);
    }
    return this.sql
      .selectObjects<ItemRow>('SELECT * FROM items ORDER BY name LIMIT ?', [limit])
      .map(rowToItem);
  }

  async recordDataset(input: {
    label: string;
    wzVersion: string;
    files: { name: string; size: number | null }[];
    notes?: string;
  }): Promise<DatasetRecord> {
    return this.sql.transaction(() => {
      this.sql.exec(
        'INSERT INTO datasets (label, loaded_at, wz_version, notes) VALUES (?, ?, ?, ?)',
        [input.label, Date.now(), input.wzVersion, input.notes ?? null],
      );
      const id = Number(this.sql.selectValue('SELECT last_insert_rowid()'));
      for (const f of input.files) {
        this.sql.exec('INSERT INTO dataset_files (dataset_id, name, size) VALUES (?, ?, ?)', [
          id,
          f.name,
          f.size ?? null,
        ]);
      }
      return this.readDataset(id)!;
    });
  }

  async listDatasets(): Promise<DatasetRecord[]> {
    const ids = this.sql
      .selectObjects<{ id: number }>('SELECT id FROM datasets ORDER BY loaded_at DESC')
      .map((r) => r.id);
    return ids.map((id) => this.readDataset(id)!).filter(Boolean);
  }

  async clearAllData(): Promise<void> {
    this.sql.transaction(() => {
      // Order respects FK direction. No foreign keys are declared yet, but
      // keep the order stable for when we add them.
      const tables = [
        'quest_rewards',
        'quest_requirements',
        'map_portals',
        'map_mobs',
        'map_npcs',
        'quests',
        'maps',
        'npcs',
        'mobs',
        'equips',
        'items',
        'assets',
        'dataset_files',
        'datasets',
      ];
      for (const t of tables) this.sql.exec(`DELETE FROM ${t}`);
    });
  }

  // -- internals -------------------------------------------------------------

  private upsertItemRow(item: ItemRecord): void {
    this.sql.exec(
      `INSERT INTO items (
        id, name, description, category, subcategory, icon_path,
        price, stack_size, required_level, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name           = excluded.name,
        description    = excluded.description,
        category       = excluded.category,
        subcategory    = excluded.subcategory,
        icon_path      = excluded.icon_path,
        price          = excluded.price,
        stack_size     = excluded.stack_size,
        required_level = excluded.required_level,
        source_path    = excluded.source_path`,
      [
        item.id,
        item.name,
        item.description,
        item.category,
        item.subcategory,
        item.iconPath,
        item.price,
        item.stackSize,
        item.requiredLevel,
        item.sourcePath,
      ],
    );
  }

  private countOf(table: string): number {
    return Number(this.sql.selectValue(`SELECT COUNT(*) FROM ${table}`) ?? 0);
  }

  private readDataset(id: number): DatasetRecord | null {
    const ds = this.sql.selectObject<{
      id: number;
      label: string;
      loaded_at: number;
      wz_version: string;
      notes: string | null;
    }>('SELECT * FROM datasets WHERE id = ?', [id]);
    if (!ds) return null;
    const files = this.sql.selectObjects<{ name: string; size: number | null }>(
      'SELECT name, size FROM dataset_files WHERE dataset_id = ? ORDER BY name',
      [id],
    );
    return {
      id: ds.id,
      label: ds.label,
      loadedAt: ds.loaded_at,
      wzVersion: ds.wz_version,
      notes: ds.notes,
      files,
    };
  }
}
