import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

type Variant = 'default' | 'secondary' | 'outline' | 'destructive';

const VARIANTS: Record<string, Variant> = {
  // articles
  published: 'default',
  scheduled: 'secondary',
  in_review: 'secondary',
  draft: 'outline',
  archived: 'outline',
  // bills
  passed: 'default',
  rejected: 'destructive',
  vetoed: 'destructive',
  withdrawn: 'outline',
  // promises
  kept: 'default',
  in_progress: 'secondary',
  broken: 'destructive',
  not_rated: 'outline',
  // votes
  yes: 'default',
  no: 'destructive',
  abstain: 'secondary',
  absent: 'outline',
  // media
  ready: 'default',
  processing: 'secondary',
  pending: 'outline',
  failed: 'destructive',
};

export type BadgeGroup = 'article' | 'bill' | 'billStage' | 'media' | 'organizationType' | 'promise' | 'vote' | 'sponsorRole' | 'billInitiator' | 'correctionEntity';

/** Translated status badge, e.g. <StatusBadge group="article" value="draft" />. */
export function StatusBadge({ group, value }: { group: BadgeGroup; value: string }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANTS[value] ?? 'secondary'}>{t(`status.${group}.${value}`)}</Badge>;
}
