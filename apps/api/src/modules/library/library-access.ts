import { LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';

/** Who is looking at the library, resolved once per request. */
export interface LibraryViewer {
  userId: string;
  /** Null when the user has no department — they see Firm items + their own uploads only. */
  departmentId: number | null;
  /** `library:curate` — sees everything, may edit/archive/delete any item. */
  isCurator: boolean;
  /** Request context for the activity log (S2); absent in background jobs and tests. */
  ip?: string | null;
  userAgent?: string | null;
}

/** The minimum an item needs for an access decision. */
export interface LibraryAccessItem {
  status: LibraryItemStatus;
  visibility: LibraryVisibility;
  uploadedById: string;
  departmentIds: number[];
}

/**
 * Single-item visibility (get / preview / download). Mirrors {@link libraryScopeSql}:
 * curators see everything; uploaders see their own items in any state; everyone else
 * sees Published items that are Firm-wide or restricted to their department.
 */
export function canSeeItem(item: LibraryAccessItem, viewer: LibraryViewer): boolean {
  if (viewer.isCurator) return true;
  // Quarantined (virus found, S3 D24): curators only — not even the uploader.
  if (item.status === LibraryItemStatus.Quarantined) return false;
  if (item.uploadedById === viewer.userId) return true;
  if (item.status !== LibraryItemStatus.Published) return false;
  if (item.visibility === LibraryVisibility.Firm) return true;
  return viewer.departmentId != null && item.departmentIds.includes(viewer.departmentId);
}

/** Metadata / file / archive rights. Delete is curator-only and checked separately. */
export function canEditItem(
  item: Pick<LibraryAccessItem, 'uploadedById'> & Partial<Pick<LibraryAccessItem, 'status'>>,
  viewer: LibraryViewer,
): boolean {
  if (item.status === LibraryItemStatus.Quarantined) return viewer.isCurator;
  return viewer.isCurator || item.uploadedById === viewer.userId;
}

export interface SqlFragment {
  sql: string;
  params: unknown[];
}

/**
 * SQL equivalent of {@link canSeeItem} for lists, counts and tag aggregation, applied in the
 * database so filtering happens before LIMIT. `alias` is the `library_items` table alias.
 *
 * Drafts are never listed (they are in-flight uploads); a non-curator's own Archived items are
 * reachable only through the explicit `mine` + `Archived` filter handled by the caller.
 */
export function libraryScopeSql(alias: string, viewer: LibraryViewer): SqlFragment {
  if (viewer.isCurator) return { sql: 'true', params: [] };
  const parts = [`${alias}.visibility = 'Firm'`, `${alias}.uploaded_by_id = ?`];
  const params: unknown[] = [viewer.userId];
  if (viewer.departmentId != null) {
    parts.push(
      `exists (select 1 from library_item_departments lid where lid.item_id = ${alias}.id and lid.department_id = ?)`,
    );
    params.push(viewer.departmentId);
  }
  return { sql: `(${parts.join(' or ')})`, params };
}

// ------------------------------------------------------------------ collections (S1)

export interface CollectionAccess {
  status: 'Active' | 'Archived';
  visibility: LibraryVisibility;
  ownerId: string;
  departmentIds: number[];
}

/** Same rule as items: curators all; owners always; others Active + (Firm or their department). */
export function canSeeCollection(c: CollectionAccess, viewer: LibraryViewer): boolean {
  if (viewer.isCurator) return true;
  if (c.ownerId === viewer.userId) return true;
  if (c.status !== 'Active') return false;
  if (c.visibility === LibraryVisibility.Firm) return true;
  return viewer.departmentId != null && c.departmentIds.includes(viewer.departmentId);
}

export function canEditCollection(c: Pick<CollectionAccess, 'ownerId'>, viewer: LibraryViewer): boolean {
  return viewer.isCurator || c.ownerId === viewer.userId;
}

/** SQL twin of {@link canSeeCollection} (status filter applied by the caller, like items). */
export function collectionScopeSql(alias: string, viewer: LibraryViewer): SqlFragment {
  if (viewer.isCurator) return { sql: 'true', params: [] };
  const parts = [`${alias}.visibility = 'Firm'`, `${alias}.owner_id = ?`];
  const params: unknown[] = [viewer.userId];
  if (viewer.departmentId != null) {
    parts.push(
      `exists (select 1 from library_collection_departments lcd where lcd.collection_id = ${alias}.id and lcd.department_id = ?)`,
    );
    params.push(viewer.departmentId);
  }
  return { sql: `(${parts.join(' or ')})`, params };
}

/**
 * Items a viewer may see *inside lists* (Published + item scope). Used for collection item
 * lists, counts and exports.
 */
export function visibleItemSql(alias: string, viewer: LibraryViewer): SqlFragment {
  const scope = libraryScopeSql(alias, viewer);
  return { sql: `(${alias}.status = 'Published' and ${scope.sql})`, params: scope.params };
}

/** Collections visible to the viewer, including their own archived ones. */
export function visibleCollectionSql(alias: string, viewer: LibraryViewer): SqlFragment {
  if (viewer.isCurator) return { sql: 'true', params: [] };
  const scope = collectionScopeSql(alias, viewer);
  return {
    sql: `(${alias}.owner_id = ? or (${alias}.status = 'Active' and ${scope.sql}))`,
    params: [viewer.userId, ...scope.params],
  };
}
