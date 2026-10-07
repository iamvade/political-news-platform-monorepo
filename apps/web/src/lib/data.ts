import 'server-only';
import { isApiError, type CallOptions } from '@news/shared/api-client';
import type { PublicArticle, PublicArticleSummary, PublicHomepage, PublicParliamentWeek, PublicPerson } from '@news/shared/schemas';
import { notFound } from 'next/navigation';
import { getApi } from './api';
import { cacheTags } from './cache-tags';

/**
 * Cached fetch through Next's data cache: shared by every page that asks for the same URL, refreshed on
 * demand when the API revalidates one of `tags`, and at the latest after `revalidate` seconds.
 */
export function cached(tags: string[], revalidate: number): CallOptions {
  return { init: { cache: 'force-cache', next: { tags, revalidate } } };
}

/** 404 and 410 (unpublished) from the API become this site's not-found page. */
function notFoundOn404<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: unknown) => {
    if (isApiError(err) && (err.status === 404 || err.status === 410)) notFound();
    throw err;
  });
}

export async function getHomepage(): Promise<PublicHomepage> {
  return (await getApi().public.homepage.get(cached([cacheTags.homepage], 300))).data;
}

export async function getLatestArticles(pageSize: number): Promise<PublicArticleSummary[]> {
  return (await getApi().public.articles.list({ pageSize }, cached([cacheTags.homepage, cacheTags.articles], 300))).data;
}

export async function getParliamentWeek(): Promise<PublicParliamentWeek> {
  return (await getApi().public.parliament.week(cached([cacheTags.parliament, cacheTags.homepage], 600))).data;
}

/** The article for `/news/{id}-{slug}`; the id in the URL must be the article's. */
export async function getArticle(id: number, slug: string): Promise<PublicArticle> {
  const { data } = await notFoundOn404(getApi().public.articles.get(slug, cached([cacheTags.article(id)], 300)));
  if (data.id !== id) notFound();
  return data;
}

/** The person for `/person/{id}-{slug}`; the id in the URL must be the person's. */
export async function getPerson(id: number, slug: string): Promise<PublicPerson> {
  const { data } = await notFoundOn404(getApi().public.persons.get(slug, cached([cacheTags.person(id), cacheTags.people], 600)));
  if (data.id !== id) notFound();
  return data;
}

export async function getPersonArticles(id: number, slug: string, pageSize: number): Promise<PublicArticleSummary[]> {
  return (await getApi().public.persons.articles(slug, { pageSize }, cached([cacheTags.person(id), cacheTags.articles], 300))).data;
}

/**
 * During `next build` an unreachable API must not fail the build (the image is built before the stack is
 * up): the page renders its "unavailable" state, and ISR replaces it on the first revalidation.
 */
export async function duringBuildOr<T, F>(load: () => Promise<T>, fallback: F): Promise<T | F> {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return load();
  try {
    return await load();
  } catch (err) {
    console.warn('API unreachable during build; rendering the fallback', err instanceof Error ? err.message : err);
    return fallback;
  }
}
