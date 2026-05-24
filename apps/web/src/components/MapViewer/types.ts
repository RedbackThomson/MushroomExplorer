export type LayerKey = 'spawns' | 'portals' | 'teleports' | 'npcs' | 'mobs';

export type LayerVisibility = Record<LayerKey, boolean>;

export interface MapViewerHighlight {
  kind: 'npc' | 'mob' | 'portal';
  /** Stringified entity id (npc/mob) or portal name. */
  key: string;
}
