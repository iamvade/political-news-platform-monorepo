import type { PaginationMeta } from '@news/shared/schemas';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { errorMessage } from '@/lib/notify';
import { PAGE_SIZES, type ListParamsApi } from './use-list-params';

export interface FilterOption {
  value: string;
  label: string;
}

export type FilterDef =
  | { key: string; label: string; type: 'select'; options: FilterOption[] }
  | { key: string; label: string; type: 'toggle' };

export interface DataTableProps<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack column defs are heterogeneous by design
  columns: ColumnDef<T, any>[];
  rows: T[] | undefined;
  pagination: PaginationMeta | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
  list: ListParamsApi;
  searchPlaceholder?: string;
  /** False for endpoints without a `search` parameter (hides the search box). */
  searchable?: boolean;
  filters?: FilterDef[];
  getRowId?: (row: T) => string;
}

const ALL = '__all__';
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 5;

/** Debounced search box that follows the URL value (e.g. back button) without effects that set state. */
function SearchBox({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => onCommit(draft), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  return (
    <div className="relative w-full sm:w-72">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="pl-8" />
    </div>
  );
}

/**
 * Server-paginated table: search, select/toggle filters and pagination, all stored in the URL via useListParams.
 * Shows skeleton rows while loading, an error with retry, and an empty state.
 */
export function DataTable<T>({
  columns,
  rows,
  pagination,
  isLoading,
  isFetching,
  error,
  onRetry,
  list,
  searchPlaceholder,
  searchable = true,
  filters = [],
  getRowId,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { params } = list;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions; this component does not rely on memoization
  const table = useReactTable({
    data: rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? -1,
    getRowId,
  });

  const columnCount = columns.length;
  const totalPages = Math.max(pagination?.totalPages ?? 1, 1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && <SearchBox value={params.search} placeholder={searchPlaceholder ?? t('table.search')} onCommit={list.setSearch} />}
        {filters.map((filter) =>
          filter.type === 'select' ? (
            <Select
              key={filter.key}
              value={params.filters[filter.key] ?? ALL}
              onValueChange={(value) => list.setFilter(filter.key, value === ALL ? undefined : value)}
            >
              <SelectTrigger className="w-44" aria-label={filter.label}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>
                  {filter.label}: {t('table.all')}
                </SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button
              key={filter.key}
              type="button"
              variant={params.filters[filter.key] ? 'default' : 'outline'}
              aria-pressed={Boolean(params.filters[filter.key])}
              onClick={() => list.setFilter(filter.key, params.filters[filter.key] ? undefined : '1')}
            >
              {filter.label}
            </Button>
          ),
        )}
        {isFetching && !isLoading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
            <Loader2Icon className="size-3 animate-spin" aria-hidden />
            {t('table.refreshing')}
          </span>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t('table.error')} {errorMessage(error)}
            </span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t('table.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <TableRow key={`skeleton-${i}`} data-testid="skeleton-row">
                  {Array.from({ length: columnCount }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  {error ? '—' : t('table.empty')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{t('table.total', { total: pagination?.total ?? 0 })}</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span>{t('table.rowsPerPage')}</span>
            <Select value={String(params.pageSize)} onValueChange={(value) => list.setPageSize(Number(value))}>
              <SelectTrigger className="h-8 w-20" aria-label={t('table.rowsPerPage')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span>{t('table.pageOf', { page: params.page, totalPages })}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={params.page <= 1} onClick={() => list.setPage(params.page - 1)}>
              <ChevronLeftIcon aria-hidden />
              {t('table.previous')}
            </Button>
            <Button size="sm" variant="outline" disabled={params.page >= totalPages} onClick={() => list.setPage(params.page + 1)}>
              {t('table.next')}
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
