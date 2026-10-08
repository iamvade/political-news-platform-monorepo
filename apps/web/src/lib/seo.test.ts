import type { PublicArticle, PublicPerson } from '@news/shared/schemas';
import { describe, expect, it } from 'vitest';
import { articleSummary, cover } from '@/test/fixtures';
import { articleMetadata, articleShareImage, breadcrumbJsonLd, categoryShareImage, collectionPageJsonLd, newsArticleJsonLd, organizationJsonLd, personJsonLd, personMetadata, plainText, sectionMetadata, serializeJsonLd, shareImage, type SiteInfo } from './seo';

const site: SiteInfo = { url: 'https://news.example.mn', name: 'Улс төрийн мэдээ', description: 'Тайлбар' };

const article: PublicArticle = {
  ...articleSummary({ cover: { ...cover, variants: [...cover.variants, { width: 1600, height: 900, url: 'https://media.example/a-1600.webp' }] } }),
  bodyHtml: '<p>Их Хурал &amp; Засгийн газар.</p>',
  bodyJson: { type: 'doc', content: [] },
  author: { displayName: 'Б.Сараа' },
  tags: [{ slug: 'tosov', nameMn: 'Төсөв', nameEn: null }],
  persons: [{ id: 12, slug: 'g-batbayar', displayName: 'Г.Батбаяр', givenNameMn: 'Батбаяр', patronymicMn: 'Ганболд' }],
  organizations: [{ slug: 'mpp', type: 'party', nameMn: 'Монгол Ардын Нам', nameEn: null, shortNameMn: 'МАН', color: null }],
  bills: [],
  corrections: [],
};

const party = { slug: 'mpp', type: 'party' as const, nameMn: 'Монгол Ардын Нам', nameEn: null, shortNameMn: 'МАН', color: '#C8102E' };
const person: PublicPerson = {
  id: 12,
  slug: 'g-batbayar',
  displayName: 'Г.Батбаяр',
  givenNameMn: 'Батбаяр',
  patronymicMn: 'Ганболд',
  givenNameEn: 'Batbayar',
  patronymicEn: 'Ganbold',
  birthDate: '1975-03-02',
  bioMn: null,
  photo: null,
  currentPositions: [
    { titleMn: 'УИХ-ын гишүүн', titleEn: null, startDate: '2024-07-01', endDate: null, sourceUrl: 'https://parliament.mn/x', organization: { slug: 'ikh-khural', type: 'parliament', nameMn: 'Улсын Их Хурал', nameEn: null, shortNameMn: 'УИХ', color: null } },
    { titleMn: 'Гишүүн', titleEn: null, startDate: '2010-01-01', endDate: null, sourceUrl: 'https://mpp.mn/x', organization: party },
  ],
  party,
  constituency: null,
};

describe('metadata', () => {
  it('article: canonical, Open Graph article fields, the largest image up to 1600px, Twitter card', () => {
    const meta = articleMetadata(article, site);

    expect(meta.alternates?.canonical).toBe('https://news.example.mn/news/42-ikh-khural-tosviig-batlav');
    expect(meta.openGraph).toMatchObject({
      type: 'article',
      locale: 'mn_MN',
      publishedTime: article.publishedAt,
      section: 'Улс төр',
      tags: ['Төсөв'],
      images: [{ url: 'https://media.example/a-1600.webp', width: 1600, height: 900, alt: 'Төрийн ордон' }],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: ['https://media.example/a-1600.webp'] });
  });

  it('without a cover: the article\'s own headline card and a text description', () => {
    const meta = articleMetadata({ ...article, cover: null, lede: null }, site);
    expect(meta.description).toBe('Их Хурал & Засгийн газар.');
    const [image] = meta.openGraph?.images as { url: string }[];
    expect(image).toEqual({ url: expect.stringMatching(/^https:\/\/news\.example\.mn\/news\/42-ikh-khural-tosviig-batlav\/share-card\?v=[0-9a-f]{12}$/), width: 1200, height: 630, alt: article.title });
    expect(meta.twitter).toMatchObject({ images: [image!.url] });
    expect(newsArticleJsonLd({ ...article, cover: null }, site).image).toEqual([image!.url]);
  });

  it('the share card URL changes with the text on the card, and only then', () => {
    const url = (a: PublicArticle) => articleShareImage(a, site).url;
    expect(url(article)).toBe(url({ ...article, lede: 'Өөр', updatedAt: '2030-01-01T00:00:00.000Z', bodyHtml: '<p>x</p>' }));
    expect(url(article)).not.toBe(url({ ...article, title: `${article.title}!` }));
    expect(url(article)).not.toBe(url({ ...article, category: null }));
  });

  it('section: every page canonical to itself, website type, the versioned category card', () => {
    const category = { slug: 'uls-tor', nameMn: 'Улс төр' };
    const first = sectionMetadata(category, { page: 1, title: 'Улс төр', description: 'Тайлбар' }, site);
    const third = sectionMetadata(category, { page: 3, title: 'Улс төр — 3-р хуудас', description: 'Тайлбар' }, site);

    expect(first.alternates?.canonical).toBe('https://news.example.mn/section/uls-tor');
    expect(third.alternates?.canonical).toBe('https://news.example.mn/section/uls-tor/3');
    expect(third.title).toBe('Улс төр — 3-р хуудас');
    const image = categoryShareImage(category, site);
    expect(image.url).toMatch(/^https:\/\/news\.example\.mn\/section\/uls-tor\/share-card\?v=[0-9a-f]{12}$/);
    expect(first.openGraph).toMatchObject({ type: 'website', url: 'https://news.example.mn/section/uls-tor', locale: 'mn_MN', images: [image] });
    expect(first.twitter).toMatchObject({ card: 'summary_large_image', images: [image.url] });
  });

  it('the category card URL changes with the name only', () => {
    expect(categoryShareImage({ slug: 'uls-tor', nameMn: 'Улс төр' }, site).url).toBe(categoryShareImage({ slug: 'uls-tor', nameMn: 'Улс төр' }, site).url);
    expect(categoryShareImage({ slug: 'uls-tor', nameMn: 'Улс төр' }, site).url).not.toBe(categoryShareImage({ slug: 'uls-tor', nameMn: 'Улс төрийн' }, site).url);
  });

  it('person: profile type, role and party in the description', () => {
    const meta = personMetadata(person, site);
    expect(meta.description).toBe('УИХ-ын гишүүн, МАН');
    expect(meta.openGraph).toMatchObject({ type: 'profile', url: 'https://news.example.mn/person/12-g-batbayar' });
  });
});

describe('JSON-LD', () => {
  it('NewsArticle names the publisher, author, dates and the people it mentions', () => {
    const ld = newsArticleJsonLd(article, site);
    expect(ld).toMatchObject({
      '@type': 'NewsArticle',
      headline: article.title,
      datePublished: article.publishedAt,
      author: [{ '@type': 'Person', name: 'Б.Сараа' }],
      publisher: {
        '@id': 'https://news.example.mn/#organization',
        '@type': 'NewsMediaOrganization',
        name: 'Улс төрийн мэдээ',
        url: 'https://news.example.mn/',
        logo: { '@type': 'ImageObject', url: 'https://news.example.mn/opengraph-image' },
      },
      mentions: [
        { '@type': 'Person', name: 'Г.Батбаяр', url: 'https://news.example.mn/person/12-g-batbayar' },
        { '@type': 'Organization', name: 'Монгол Ардын Нам', alternateName: 'МАН' },
      ],
    });
  });

  it('the publisher node inside NewsArticle has no @context; the standalone one does', () => {
    expect(newsArticleJsonLd(article, site).publisher).not.toHaveProperty('@context');
    expect(organizationJsonLd(site)).toMatchObject({ '@context': 'https://schema.org', '@id': 'https://news.example.mn/#organization' });
  });

  it('BreadcrumbList numbers items from 1 with absolute URLs', () => {
    const ld = breadcrumbJsonLd(site, [
      { name: 'Нүүр', path: '/' },
      { name: article.title, path: '/news/42-ikh-khural-tosviig-batlav' },
    ]);
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Нүүр', item: 'https://news.example.mn/' },
        { '@type': 'ListItem', position: 2, name: article.title, item: 'https://news.example.mn/news/42-ikh-khural-tosviig-batlav' },
      ],
    });
  });

  it('CollectionPage lists the page\'s articles with positions continuing from earlier pages', () => {
    const ld = collectionPageJsonLd(
      site,
      { path: '/section/uls-tor/2', name: 'Улс төр — 2-р хуудас', description: 'Тайлбар' },
      [articleSummary({ id: 7, slug: 'a', title: 'А' }), articleSummary({ id: 6, slug: 'b', title: 'Б' })],
      20,
    );
    expect(ld).toMatchObject({
      '@type': 'CollectionPage',
      url: 'https://news.example.mn/section/uls-tor/2',
      isPartOf: { '@id': 'https://news.example.mn/#website' },
      publisher: { '@type': 'NewsMediaOrganization', name: 'Улс төрийн мэдээ' },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          { '@type': 'ListItem', position: 21, url: 'https://news.example.mn/news/7-a', name: 'А' },
          { '@type': 'ListItem', position: 22, url: 'https://news.example.mn/news/6-b', name: 'Б' },
        ],
      },
    });
  });

  it('Person carries roles, party affiliation and memberships', () => {
    const ld = personJsonLd(person, site);
    expect(ld).toMatchObject({
      '@type': 'Person',
      name: 'Г.Батбаяр',
      alternateName: 'Batbayar Ganbold',
      jobTitle: ['УИХ-ын гишүүн'],
      affiliation: { '@type': 'Organization', name: 'Монгол Ардын Нам' },
    });
    expect((ld.memberOf as unknown[]).length).toBe(2);
  });

  it('cannot break out of the script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});

describe('helpers', () => {
  it('plainText strips tags and cuts at a word', () => {
    expect(plainText('<p>Нэг <strong>хоёр</strong></p><p>гурав</p>')).toBe('Нэг хоёр гурав');
    expect(plainText(`<p>${'үг '.repeat(100)}</p>`, 20).endsWith('…')).toBe(true);
  });

  it('shareImage ignores media without public URLs', () => {
    expect(shareImage({ ...cover, url: null, variants: [{ width: 320, height: 180, url: null }] }, 'x')).toBeNull();
  });
});
