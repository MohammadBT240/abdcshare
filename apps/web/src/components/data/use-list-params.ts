'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface ListParams {
  page: number;
  pageSize: number;
  q: string;
  sort: string;
  extra: Record<string, string>;
}

export function useListParams(defaults?: { pageSize?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params: ListParams = useMemo(() => {
    const extra: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (!['page', 'pageSize', 'q', 'sort'].includes(key)) extra[key] = value;
    });
    return {
      page: Math.max(1, Number(searchParams.get('page') ?? 1) || 1),
      pageSize: Math.min(100, Math.max(1, Number(searchParams.get('pageSize') ?? defaults?.pageSize ?? 20) || 20)),
      q: searchParams.get('q') ?? '',
      sort: searchParams.get('sort') ?? '',
      extra,
    };
  }, [searchParams, defaults?.pageSize]);

  const setParams = useCallback(
    (patch: {
      page?: number;
      pageSize?: number;
      q?: string;
      sort?: string;
      extra?: Record<string, string | undefined>;
    }) => {
      const next = new URLSearchParams(searchParams.toString());
      const page = patch.page ?? params.page;
      const pageSize = patch.pageSize ?? params.pageSize;
      const q = patch.q !== undefined ? patch.q : params.q;
      const sort = patch.sort !== undefined ? patch.sort : params.sort;

      next.set('page', String(page));
      next.set('pageSize', String(pageSize));
      if (q) next.set('q', q);
      else next.delete('q');
      if (sort) next.set('sort', sort);
      else next.delete('sort');

      if (patch.extra) {
        for (const [k, v] of Object.entries(patch.extra)) {
          if (v == null || v === '') next.delete(k);
          else next.set(k, v);
        }
      }

      // Reset to page 1 when filters/search change (unless page explicitly set)
      if (patch.q !== undefined || patch.extra || patch.sort !== undefined) {
        if (patch.page === undefined) next.set('page', '1');
      }

      router.replace(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams, params],
  );

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(params.page));
    sp.set('pageSize', String(params.pageSize));
    if (params.q) sp.set('q', params.q);
    if (params.sort) sp.set('sort', params.sort);
    for (const [k, v] of Object.entries(params.extra)) sp.set(k, v);
    return sp.toString();
  }, [params]);

  return { params, setParams, queryString };
}
