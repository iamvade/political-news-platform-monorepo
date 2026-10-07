import { isApiError } from '@news/shared/api-client';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/notify';
import { NotFoundPage } from '@/pages/status-pages';
import { BillForm } from './bill-form';
import { SponsorsSection } from './sponsors-section';
import { StagesSection } from './stages-section';
import { VoteSessionsSection } from './vote-sessions-section';

export const parseId = (id: string) => (id === 'new' ? null : /^\d+$/.test(id) ? Number(id) : NaN);

/** `/bills/new` and `/bills/:id`: bill form, stages, sponsors and roll calls. */
export function BillPage() {
  const { t } = useTranslation();
  const { id = 'new' } = useParams();
  const billId = parseId(id);
  const query = useQuery({
    queryKey: ['bill', billId],
    queryFn: () => api.admin.bills.get(billId!),
    enabled: billId !== null && !Number.isNaN(billId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  if (Number.isNaN(billId)) return <NotFoundPage />;
  if (billId === null) return <BillForm key="new" bill={null} />;
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
  const bill = query.data.data;
  return (
    <div className="space-y-6">
      <BillForm key={billId} bill={bill} />
      <div className="grid gap-6 lg:grid-cols-2">
        <StagesSection billId={billId} />
        <SponsorsSection bill={bill} />
      </div>
      <VoteSessionsSection billId={billId} />
    </div>
  );
}
