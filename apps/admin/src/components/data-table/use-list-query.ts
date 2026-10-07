import type { PaginationMeta } from '@news/shared/schemas';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ListParams } from './use-list-params';

/** TanStack Query wrapper for list endpoints: keeps previous rows visible while the next page loads. */
export function useListQuery<T>(key: string, params: ListParams, fetcher: (params: ListParams) => Promise<{ data: T[]; pagination: PaginationMeta }>) {
  const query = useQuery({
    queryKey: [key, params],
    queryFn: () => fetcher(params),
    placeholderData: keepPreviousData,
  });
  return {
    rows: query.data?.data,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
