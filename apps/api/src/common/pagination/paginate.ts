import { buildPageMeta, type Paginated, type PaginationQuery } from '@abdcshare/shared';

/**
 * Pagination helpers. We deliberately do NOT wrap `em.findAndCount`: MikroORM's
 * `FindOptions` uses path-literal types (`AutoPath`) that only resolve against a
 * concrete entity, so a generic wrapper cannot type-check `populate`/`orderBy`.
 * Instead the service calls `findAndCount` with its concrete entity, and these
 * helpers standardise the offset math and the `meta` shape.
 */

/** Normalise page/pageSize into limit/offset for a query. */
export function pageParams(query: Pick<PaginationQuery, 'page' | 'pageSize'>): {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
} {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/** Wrap already-fetched rows + total into the shared paginated envelope. */
export function paginated<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { data, meta: buildPageMeta(page, pageSize, total) };
}
