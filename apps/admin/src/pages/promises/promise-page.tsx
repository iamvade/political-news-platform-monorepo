import { isApiError } from '@news/shared/api-client';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/notify';
import { parseId } from '@/pages/bills/bill-page';
import { NotFoundPage } from '@/pages/status-pages';
import { PromiseForm } from './promise-form';
import { PromiseStatusSection } from './promise-status-section';

/** `/promises/new[?personId=]` and `/promises/:id`. */
export function PromisePage() {
  const { t } = useTranslation();
  const { id = 'new' } = useParams();
  const [params] = useSearchParams();
  const promiseId = parseId(id);
  const query = useQuery({
    queryKey: ['promise', promiseId],
    queryFn: () => api.admin.promises.get(promiseId!),
    enabled: promiseId !== null && !Number.isNaN(promiseId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (Number.isNaN(promiseId)) return <NotFoundPage />;
  if (promiseId === null) {
    const personId = Number(params.get('personId'));
    return <PromiseForm key="new" promise={null} defaultPersonId={Number.isInteger(personId) && personId > 0 ? personId : undefined} />;
  }
  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    if (isApiError(query.error) && query.error.status === 404) return <NotFoundPage />;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-destructive">{errorMessage(query.error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
          {t('table.retry')}
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PromiseForm key={promiseId} promise={query.data.data} />
      <PromiseStatusSection promise={query.data.data} />
    </div>
  );
}
