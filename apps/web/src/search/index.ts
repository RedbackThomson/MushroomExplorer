// Search layer.
//
// Owns the MiniSearch index across all entity types. Reads from the DB layer
// only; never touches the parser or extractors directly.
//
// Implementation lands in Phase 3.

export interface SearchHit {
  id: string;
  entity: 'item' | 'equip' | 'mob' | 'npc' | 'map' | 'quest';
  name: string;
  score: number;
}

export interface SearchIndex {
  query(input: string): SearchHit[];
}
