import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const PAGE_SIZES = [20, 50, 100] as const;

export interface ListParams {
  page: number;
  pageSize: number;
  search: string;
  /** Raw filter values from the URL; validate them before sending (see the list pages). */
  filters: Record<string, string | undefined>;
}

export interface ListParamsApi {
  params: ListParams;
  setSearch: (search: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * List state (page, page size, search, filters) lives in the URL, so lists are shareable and the back button works.
 * Changing search or a filter resets to page 1.
 */
export function useListParams(filterKeys: readonly string[]): ListParamsApi {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<ListParams>(() => {
    const pageSize = positiveInt(searchParams.get('pageSize'), PAGE_SIZES[0]);
    return {
      page: positiveInt(searchParams.get('page'), 1),
      pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : PAGE_SIZES[0],
      search: searchParams.get('search') ?? '',
      filters: Object.fromEntries(filterKeys.map((key) => [key, searchParams.get(key) ?? undefined])),
    };
  }, [searchParams, filterKeys]);

  const update = useCallback(
    (patch: Record<string, string | undefined>, opts: { resetPage: boolean; replace: boolean }) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (opts.resetPage) next.delete('page');
          return next;
        },
        { replace: opts.replace },
      );
    },
    [setSearchParams],
  );

  return {
    params,
    setSearch: useCallback((search) => update({ search: search.trim() || undefined }, { resetPage: true, replace: true }), [update]),
    setFilter: useCallback((key, value) => update({ [key]: value }, { resetPage: true, replace: false }), [update]),
    setPage: useCallback((page) => update({ page: page > 1 ? String(page) : undefined }, { resetPage: false, replace: false }), [update]),
    setPageSize: useCallback(
      (pageSize) => update({ pageSize: pageSize === PAGE_SIZES[0] ? undefined : String(pageSize) }, { resetPage: true, replace: false }),
      [update],
    ),
  };
}
