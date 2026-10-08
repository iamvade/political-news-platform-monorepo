import { notFound } from 'next/navigation';
import messages from '../../../../../messages/mn.json';
import { getArticle } from '@/lib/data';
import { parseIdSlug } from '@/lib/routes';
import { renderShareCard } from '@/lib/share-card';

// The share card of an article without a cover. Pages link to it with `?v=<hash of the card text>`
// (articleShareImage in lib/seo.ts), so one URL always shows the same card and the CDN may keep it for a year.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=31536000, immutable';

type Context = { params: Promise<{ idSlug: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  const ref = parseIdSlug((await params).idSlug);
  if (!ref) notFound();
  // Same cached, tagged loader as the page: no extra API request, and 404/410 become not-found.
  const article = await getArticle(ref.id, ref.slug);
  return renderShareCard({ eyebrow: article.category?.nameMn, title: article.title, footer: messages.site.name }, { 'cache-control': CACHE_CONTROL });
}
