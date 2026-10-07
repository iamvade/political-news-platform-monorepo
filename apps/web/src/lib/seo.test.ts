import type { PublicArticle, PublicPerson } from '@news/shared/schemas';
import { describe, expect, it } from 'vitest';
import { articleSummary, cover } from '@/test/fixtures';
import { articleMetadata, newsArticleJsonLd, personJsonLd, personMetadata, plainText, serializeJsonLd, shareImage, type SiteInfo } from './seo';

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

  it('falls back to the generated share card and a text description', () => {
    const meta = articleMetadata({ ...article, cover: null, lede: null }, site);
    expect(meta.description).toBe('Их Хурал & Засгийн газар.');
    expect(meta.openGraph?.images).toEqual([{ url: 'https://news.example.mn/opengraph-image', width: 1200, height: 630, alt: 'Улс төрийн мэдээ' }]);
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
      publisher: { '@id': 'https://news.example.mn/#organization' },
      mentions: [
        { '@type': 'Person', name: 'Г.Батбаяр', url: 'https://news.example.mn/person/12-g-batbayar' },
        { '@type': 'Organization', name: 'Монгол Ардын Нам', alternateName: 'МАН' },
      ],
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
