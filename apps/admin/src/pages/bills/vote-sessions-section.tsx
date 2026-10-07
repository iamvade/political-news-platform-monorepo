import { VOTE_VALUES } from '@news/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const voteGridPath = (billId: number, session?: { date: string; motion: string }) =>
  session ? `/bills/${billId}/votes?${new URLSearchParams({ date: session.date, motion: session.motion }).toString()}` : `/bills/${billId}/votes`;

/** Roll calls recorded on the bill, each opening the vote grid. */
export function VoteSessionsSection({ billId }: { billId: number }) {
  const { t } = useTranslation();
  const query = useQuery({ queryKey: ['vote-sessions', billId], queryFn: () => api.admin.bills.voteSessions(billId, { pageSize: 100 }) });
  const sessions = query.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('voteSessions.title')}</CardTitle>
        <CardAction>
          <Button asChild size="sm" variant="outline">
            <Link to={voteGridPath(billId)}>
              <Plus aria-hidden />
              {t('voteSessions.new')}
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 && query.isSuccess ? (
          <p className="text-sm text-muted-foreground">{t('voteSessions.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('votes.fields.date')}</TableHead>
                <TableHead>{t('votes.fields.motion')}</TableHead>
                {VOTE_VALUES.map((value) => (
                  <TableHead key={value} className="text-right">
                    {t(`status.vote.${value}`)}
                  </TableHead>
                ))}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={`${session.date}|${session.motion}`}>
                  <TableCell>{formatDate(session.date)}</TableCell>
                  <TableCell>
                    <code className="text-xs">{session.motion}</code>
                  </TableCell>
                  {VOTE_VALUES.map((value) => (
                    <TableCell key={value} className="text-right tabular-nums">
                      {session.counts[value]}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to={voteGridPath(billId, session)}>{t('voteSessions.open')}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
