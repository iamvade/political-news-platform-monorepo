import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function FullPageLoader() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-svh items-center justify-center gap-2 text-muted-foreground" role="status">
      <Loader2Icon className="size-4 animate-spin" aria-hidden />
      <span>{t('app.loading')}</span>
    </div>
  );
}
