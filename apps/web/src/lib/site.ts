import 'server-only';
import { getTranslations } from 'next-intl/server';
import { siteUrl } from './env';
import type { SiteInfo } from './seo';

/** Site URL (SITE_URL) and name/description (mn.json) for metadata and JSON-LD. */
export async function getSiteInfo(): Promise<SiteInfo> {
  const t = await getTranslations();
  return { url: siteUrl(), name: t('site.name'), description: t('meta.description') };
}
