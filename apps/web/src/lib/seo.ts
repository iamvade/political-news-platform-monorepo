import type { PublicArticle, PublicPerson } from '@news/shared/schemas';
import type { Metadata } from 'next';
import type { PublicMedia } from './media';
import { routes } from './routes';

/** Site identity for metadata and JSON-LD (URL from SITE_URL, texts from mn.json). */
export interface SiteInfo {
  url: string;
  name: string;
  description: string;
}

export interface ShareImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** Facebook and X share cards; their recommended size is 1200×630. */
const SHARE_WIDTH = 1600;

export const absoluteUrl = (site: SiteInfo, path: string) => new URL(path, `${site.url}/`).toString();

/** The generated default card (app/opengraph-image.tsx), for pages without their own image. */
export const defaultShareImage = (site: SiteInfo): ShareImage => ({ url: absoluteUrl(site, '/opengraph-image'), width: 1200, height: 630, alt: site.name });

/** Largest WebP variant up to 1600px wide, or null when the media has no public URL. */
export function shareImage(media: PublicMedia | null, fallbackAlt: string): ShareImage | null {
  if (!media) return null;
  const variants = media.variants.filter((v): v is typeof v & { url: string } => v.url !== null);
  const best = variants.filter((v) => v.width <= SHARE_WIDTH).at(-1) ?? variants[0];
  if (!best) return null;
  return { url: best.url, width: best.width, height: best.height, alt: media.alt || fallbackAlt };
}

/** Plain text from sanitized HTML for descriptions: tags removed, whitespace collapsed, cut at a word. */
export function plainText(html: string, max = 160): string {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`;
}

export function articleMetadata(article: PublicArticle, site: SiteInfo): Metadata {
  const url = absoluteUrl(site, routes.article(article));
  const description = article.lede ?? plainText(article.bodyHtml);
  const image = shareImage(article.cover, article.title) ?? defaultShareImage(site);
  return {
    title: article.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: article.title,
      description,
      siteName: site.name,
      locale: 'mn_MN',
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      section: article.category?.nameMn,
      tags: article.tags.map((tag) => tag.nameMn),
      authors: [article.author.displayName],
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: article.title, description, images: [image.url] },
  };
}

/** "УИХ-ын гишүүн, МАН" — current roles and party, for descriptions. */
export function personSummary(person: PublicPerson): string {
  const roles = person.currentPositions.filter((p) => p.organization.type !== 'party').map((p) => p.titleMn);
  const party = person.party ? (person.party.shortNameMn ?? person.party.nameMn) : null;
  return [...new Set(roles), ...(party ? [party] : [])].join(', ');
}

export function personMetadata(person: PublicPerson, site: SiteInfo): Metadata {
  const url = absoluteUrl(site, routes.person(person));
  const description = personSummary(person) || (person.bioMn ? plainText(person.bioMn) : site.description);
  const image = shareImage(person.photo, person.displayName) ?? defaultShareImage(site);
  return {
    title: person.displayName,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', url, title: person.displayName, description, siteName: site.name, locale: 'mn_MN', images: [image] },
    twitter: { card: 'summary_large_image', title: person.displayName, description, images: [image.url] },
  };
}

// --- JSON-LD (schema.org) ------------------------------------------------------------------------------------------

type JsonLd = Record<string, unknown>;

const organizationId = (site: SiteInfo) => `${site.url}/#organization`;

/** The publisher (this news outlet). */
export function organizationJsonLd(site: SiteInfo): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': organizationId(site),
    name: site.name,
    url: absoluteUrl(site, '/'),
    logo: { '@type': 'ImageObject', url: defaultShareImage(site).url, width: 1200, height: 630 },
    correctionsPolicy: absoluteUrl(site, routes.corrections),
    ethicsPolicy: absoluteUrl(site, routes.editorialPolicy),
    ownershipFundingInfo: absoluteUrl(site, routes.ownership),
  };
}

export function websiteJsonLd(site: SiteInfo): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: absoluteUrl(site, '/'),
    name: site.name,
    description: site.description,
    inLanguage: 'mn',
    publisher: { '@id': organizationId(site) },
  };
}

const personRef = (site: SiteInfo, person: { id: number; slug: string; displayName: string }) => ({
  '@type': 'Person',
  '@id': `${absoluteUrl(site, routes.person(person))}#person`,
  name: person.displayName,
  url: absoluteUrl(site, routes.person(person)),
});

export function newsArticleJsonLd(article: PublicArticle, site: SiteInfo): JsonLd {
  const url = absoluteUrl(site, routes.article(article));
  const image = shareImage(article.cover, article.title);
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    mainEntityOfPage: url,
    url,
    headline: article.title.length > 110 ? `${article.title.slice(0, 109)}…` : article.title,
    description: article.lede ?? plainText(article.bodyHtml),
    image: image ? [image.url] : [defaultShareImage(site).url],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'mn',
    articleSection: article.category?.nameMn,
    keywords: article.tags.map((tag) => tag.nameMn),
    author: [{ '@type': 'Person', name: article.author.displayName }],
    publisher: { '@id': organizationId(site), '@type': 'NewsMediaOrganization', name: site.name },
    mentions: [
      ...article.persons.map((person) => personRef(site, person)),
      ...article.organizations.map((org) => ({ '@type': 'Organization', name: org.nameMn, alternateName: org.shortNameMn ?? undefined })),
    ],
  };
}

export function personJsonLd(person: PublicPerson, site: SiteInfo): JsonLd {
  const image = shareImage(person.photo, person.displayName);
  const latinName = [person.givenNameEn, person.patronymicEn].filter(Boolean).join(' ');
  const organization = (org: PublicPerson['currentPositions'][number]['organization']) => ({
    '@type': 'Organization',
    name: org.nameMn,
    alternateName: org.shortNameMn ?? undefined,
  });
  return {
    '@context': 'https://schema.org',
    ...personRef(site, person),
    givenName: person.givenNameMn,
    alternateName: latinName || undefined,
    image: image?.url,
    birthDate: person.birthDate ?? undefined,
    description: personSummary(person) || undefined,
    jobTitle: [...new Set(person.currentPositions.filter((p) => p.organization.type !== 'party').map((p) => p.titleMn))],
    affiliation: person.party ? organization(person.party) : undefined,
    memberOf: person.currentPositions.map((position) => ({
      '@type': 'OrganizationRole',
      roleName: position.titleMn,
      startDate: position.startDate,
      memberOf: organization(position.organization),
    })),
  };
}

/** JSON for a <script type="application/ld+json">, with characters that could end the script escaped. */
export function serializeJsonLd(value: JsonLd): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
