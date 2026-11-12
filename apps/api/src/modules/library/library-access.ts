import { LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';

/** Who is looking at the library, resolved once per request. */
export interface LibraryViewer {
  userId: string;
  /** Null when the user has no department — they see Firm items + their own uploads only. */
  departmentId: number | null;
  /** `library:curate` — sees everything, may edit/archive/delete any item. */
  isCurator: boolean;
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
  if (item.uploadedById === viewer.userId) return true;
  if (item.status !== LibraryItemStatus.Published) return false;
  if (item.visibility === LibraryVisibility.Firm) return true;
  return viewer.departmentId != null && item.departmentIds.includes(viewer.departmentId);
}

/** Metadata / file / archive rights. Delete is curator-only and checked separately. */
export function canEditItem(item: Pick<LibraryAccessItem, 'uploadedById'>, viewer: LibraryViewer): boolean {
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
