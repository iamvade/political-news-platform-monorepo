import { ConstructionIcon, SearchXIcon, ShieldXIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <CardHeader>
        <ShieldXIcon className="mx-auto size-8 text-destructive" aria-hidden />
        <CardTitle>{t('pages.forbidden.title')}</CardTitle>
        <CardDescription>{t('pages.forbidden.body')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/">{t('pages.forbidden.back')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <CardHeader>
        <SearchXIcon className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <CardTitle>{t('pages.notFound.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to="/">{t('pages.notFound.back')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** For sections whose API and screens are not built yet (Homepage, Users). */
export function NotBuiltPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t(titleKey)} />
      <Card className="max-w-lg">
        <CardHeader>
          <ConstructionIcon className="size-6 text-muted-foreground" aria-hidden />
          <CardTitle>{t('pages.notBuilt.title')}</CardTitle>
          <CardDescription>{t('pages.notBuilt.body')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
