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
  // media
  ready: 'default',
  processing: 'secondary',
  pending: 'outline',
  failed: 'destructive',
};

/** Translated status badge, e.g. <StatusBadge group="article" value="draft" />. */
export function StatusBadge({ group, value }: { group: 'article' | 'bill' | 'media' | 'organizationType'; value: string }) {
  const { t } = useTranslation();
  return <Badge variant={VARIANTS[value] ?? 'secondary'}>{t(`status.${group}.${value}`)}</Badge>;
}
