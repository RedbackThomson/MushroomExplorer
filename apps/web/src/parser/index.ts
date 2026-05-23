// Parser layer.
//
// Owns the WZ/IMG read path. Knows nothing about React or SQLite.
// Exposes a GameDataSource that produces a RawWzTree for extractors to consume.
//
// Implementation lands in Phase 1 (parser spike).

export interface RawWzNode {
  name: string;
  type: 'directory' | 'image' | 'property';
  children?: RawWzNode[];
  value?: unknown;
}

export interface RawWzTree {
  roots: RawWzNode[];
}

export interface GameDataSource {
  load(files: File[]): Promise<RawWzTree>;
}
