import { EMBED_SRC_PREFIXES } from '@news/shared/content';
import { useTranslations } from 'next-intl';
import { deferEmbeds } from '@/lib/article-html';
import { EmbedActivator } from './embed-activator';

/**
 * The article text from the API's sanitized `bodyHtml` (allowlist rendering + sanitize-html on the server),
 * with embeds turned into click-to-load placeholders. Styles: `.article-body` in globals.css.
 */
export function ArticleBody({ html }: { html: string }) {
  const t = useTranslations('article.embed');
  const body = deferEmbeds(html, { youtube: t('youtube'), facebook: t('facebook'), hint: t('hint') }, EMBED_SRC_PREFIXES);
  return (
    <>
      <div className="article-body" dangerouslySetInnerHTML={{ __html: body }} />
      {body.includes('data-embed-src') && <EmbedActivator allowedPrefixes={EMBED_SRC_PREFIXES} />}
    </>
  );
}
