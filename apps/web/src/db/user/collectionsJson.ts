// JSON shape for exporting / importing collections.
//
// Two variants share one discriminated union so an import file can carry
// either a single collection (download from a detail page) or the full
// library (download from the index page). Validation lives on the import
// path via zod; the writer side just builds plain objects.

import { z } from 'zod';
import { COLLECTION_ENTITY_TYPES } from './types';

export const COLLECTIONS_JSON_VERSION = 1 as const;

export const collectionMemberJsonSchema = z.object({
  entityType: z.enum(COLLECTION_ENTITY_TYPES),
  entityId: z.number().int(),
  note: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  done: z.boolean().optional(),
});

export const collectionBundleSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  members: z.array(collectionMemberJsonSchema),
});

export const collectionsExportSchema = z.discriminatedUnion('kind', [
  z.object({
    version: z.literal(COLLECTIONS_JSON_VERSION),
    kind: z.literal('collection'),
    collection: collectionBundleSchema,
  }),
  z.object({
    version: z.literal(COLLECTIONS_JSON_VERSION),
    kind: z.literal('all'),
    collections: z.array(collectionBundleSchema),
  }),
]);

export type CollectionMemberJson = z.infer<typeof collectionMemberJsonSchema>;
export type CollectionBundleJson = z.infer<typeof collectionBundleSchema>;
export type CollectionsExportJson = z.infer<typeof collectionsExportSchema>;

/**
 * What to do when an imported collection's `name` collides with an
 * existing one.
 *
 *   - `merge`  — re-use the existing collection; INSERT-OR-IGNORE every
 *                imported member into it. Existing description / icon
 *                are preserved.
 *   - `rename` — create a new collection with a "(imported)" /
 *                "(imported N)" suffix and import members into that.
 *   - `skip`   — leave the existing collection alone, drop the import.
 */
export type ImportConflictMode = 'merge' | 'rename' | 'skip';

export interface ImportReport {
  createdCollections: number;
  mergedCollections: number;
  renamedCollections: number;
  skippedCollections: number;
  addedMembers: number;
  /** Member rows skipped because the same (type, id) is already in the
   *  target collection. Only meaningful for `merge` mode. */
  skippedMembers: number;
  /** Names of imported collections after conflict resolution; useful
   *  for the post-import status toast. */
  importedNames: string[];
}
