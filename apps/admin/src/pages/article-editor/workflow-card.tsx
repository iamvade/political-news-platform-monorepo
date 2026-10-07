import { can, canTransition, type TransitionAction } from '@news/shared/policies';
import type { Article, AuthUser } from '@news/shared/schemas';
import { CalendarClock, EyeOff, Globe, Send, Undo } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import { isoToUbLocal, ubLocalToIso } from '@/lib/timezone';

export type TransitionPayload = { action: 'returnToDraft'; note?: string } | { action: 'schedule'; scheduledAt: string } | { action: Exclude<TransitionAction, 'returnToDraft' | 'schedule'> };

interface WorkflowCardProps {
  article: Article | null;
  user: AuthUser;
  busy: boolean;
  onTransition: (payload: TransitionPayload) => void;
}

/** Status plus the workflow buttons the shared policy allows for this user, article and status. */
export function WorkflowCard({ article, user, busy, onTransition }: WorkflowCardProps) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState<'publish' | 'unpublish' | null>(null);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [scheduleAt, setScheduleAt] = useState(() => isoToUbLocal(article?.scheduledAt));
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  if (!article) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('editor.workflow.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <StatusBadge group="article" value="draft" />
          <p className="text-muted-foreground">{t('editor.workflow.saveFirst')}</p>
        </CardContent>
      </Card>
    );
  }

  const allowed = (action: TransitionAction) => can(user, action, article) && canTransition(action, article.status);

  function schedule() {
    const iso = ubLocalToIso(scheduleAt);
    if (!iso) return setScheduleError(t('editor.workflow.scheduleInvalid'));
    if (new Date(iso).getTime() <= Date.now()) return setScheduleError(t('editor.workflow.schedulePast'));
    setScheduleError(null);
    onTransition({ action: 'schedule', scheduledAt: iso });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('editor.workflow.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <StatusBadge group="article" value={article.status} />
          {article.status === 'scheduled' && <p className="text-muted-foreground">{t('editor.workflow.scheduledFor', { date: formatDateTime(article.scheduledAt) })}</p>}
          {article.status === 'published' && <p className="text-muted-foreground">{t('editor.workflow.publishedAt', { date: formatDateTime(article.publishedAt) })}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {allowed('submit') && (
            <Button type="button" size="sm" disabled={busy} onClick={() => onTransition({ action: 'submit' })}>
              <Send aria-hidden />
              {t('editor.workflow.submit')}
            </Button>
          )}
          {allowed('returnToDraft') && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReturning(true)}>
              <Undo aria-hidden />
              {t('editor.workflow.returnToDraft')}
            </Button>
          )}
          {allowed('publish') && (
            <Button type="button" size="sm" disabled={busy} onClick={() => setConfirming('publish')}>
              <Globe aria-hidden />
              {t('editor.workflow.publish')}
            </Button>
          )}
          {allowed('unpublish') && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirming('unpublish')}>
              <EyeOff aria-hidden />
              {t('editor.workflow.unpublish')}
            </Button>
          )}
        </div>

        {allowed('schedule') && (
          <div className="space-y-1.5">
            <Label htmlFor="schedule-at">{t('editor.workflow.scheduleLabel')}</Label>
            <div className="flex gap-2">
              <Input
                id="schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                aria-describedby="schedule-tz"
              />
              <Button type="button" size="sm" variant="outline" disabled={busy || !scheduleAt} onClick={schedule}>
                <CalendarClock aria-hidden />
                {t('editor.workflow.schedule')}
              </Button>
            </div>
            <p id="schedule-tz" className="text-xs text-muted-foreground">
              {t('editor.workflow.timeZone')}
            </p>
            {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={t(confirming === 'unpublish' ? 'editor.workflow.unpublishTitle' : 'editor.workflow.publishTitle')}
        description={t(confirming === 'unpublish' ? 'editor.workflow.unpublishDescription' : 'editor.workflow.publishDescription')}
        confirmLabel={t(confirming === 'unpublish' ? 'editor.workflow.unpublish' : 'editor.workflow.publish')}
        destructive={confirming === 'unpublish'}
        onConfirm={() => confirming && onTransition({ action: confirming })}
      />

      <Dialog open={returning} onOpenChange={setReturning}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setReturning(false);
              onTransition({ action: 'returnToDraft', note: note.trim() || undefined });
              setNote('');
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('editor.workflow.returnToDraft')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="return-note">{t('editor.workflow.returnNote')}</Label>
              <Textarea id="return-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
            </div>
            <DialogFooter>
              <Button type="submit">{t('editor.workflow.returnToDraft')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
