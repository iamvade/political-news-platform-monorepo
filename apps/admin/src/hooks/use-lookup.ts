import type { LookupItem, LookupKind } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '@/lib/api';

/** Labels (and photos) for already-selected ids, e.g. linked persons of an article. */
export function useLookupItems(kind: LookupKind, ids: number[]): Map<number, LookupItem> {
  const sorted = [...ids].sort((a, b) => a - b);
  const query = useQuery({
    queryKey: ['lookup', kind, 'ids', sorted.join(',')],
    queryFn: () => api.lookup.search(kind, { ids: sorted }),
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
  });
  // Stable identity per response, so table columns that depend on it are not rebuilt every render.
  return useMemo(() => new Map((query.data?.data ?? []).map((item) => [item.id, item])), [query.data]);
}

/** Search results for a picker (only while it is open). */
export function useLookupSearch(kind: LookupKind, search: string, enabled: boolean) {
  return useQuery({
    queryKey: ['lookup', kind, 'search', search],
    queryFn: () => api.lookup.search(kind, { search: search || undefined, limit: 20 }),
    enabled,
    staleTime: 60_000,
  });
}
