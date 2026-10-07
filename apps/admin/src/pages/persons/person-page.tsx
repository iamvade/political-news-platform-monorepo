import { isApiError } from '@news/shared/api-client';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/notify';
import { NotFoundPage } from '@/pages/status-pages';
import { PersonForm } from './person-form';
import { PositionsSection } from './positions-section';
import { PersonRecordTabs } from './record-tabs';

/** `/persons/new` and `/persons/:id`: profile form, positions timeline and linked records. */
export function PersonPage() {
  const { t } = useTranslation();
  const { id = 'new' } = useParams();
  const personId = id === 'new' ? null : /^\d+$/.test(id) ? Number(id) : NaN;
  const query = useQuery({
    queryKey: ['person', personId],
    queryFn: () => api.admin.persons.get(personId!),
    enabled: personId !== null && !Number.isNaN(personId),
    // The form owns the values once loaded.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (Number.isNaN(personId)) return <NotFoundPage />;
  if (personId === null) return <PersonForm key="new" person={null} />;
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
      <PersonForm key={personId} person={query.data.data} />
      <PositionsSection personId={personId} />
      <PersonRecordTabs personId={personId} />
    </div>
  );
}
