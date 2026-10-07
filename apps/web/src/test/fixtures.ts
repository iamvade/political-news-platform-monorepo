import type { PublicArticleSummary } from '@news/shared/schemas';
import type { PartyRef } from '@/components/party-badge';
import type { PersonCardData } from '@/components/person-card';

export const cover = {
  url: 'https://media.example/a-1024.webp',
  variants: [
    { width: 320, height: 180, url: 'https://media.example/a-320.webp' },
    { width: 1024, height: 576, url: 'https://media.example/a-1024.webp' },
  ],
  alt: 'Төрийн ордон',
  credit: 'Фото: Б.Сараа',
  width: 1600,
  height: 900,
};

export function articleSummary(overrides: Partial<PublicArticleSummary> = {}): PublicArticleSummary {
  return {
    id: 42,
    slug: 'ikh-khural-tosviig-batlav',
    title: 'Их Хурал 2027 оны төсвийг баталлаа',
    lede: 'Үндсэн хуулийн өөрчлөлтийн төслийг эцсийн хэлэлцүүлэгт оруулав.',
    isBreaking: false,
    publishedAt: '2026-10-07T01:30:00.000Z',
    updatedAt: '2026-10-07T01:30:00.000Z',
    category: { slug: 'uls-tor', nameMn: 'Улс төр', nameEn: null },
    cover,
    ...overrides,
  };
}

export const party: PartyRef = { slug: 'mpp', nameMn: 'Монгол Ардын Нам', shortNameMn: 'МАН', color: '#C8102E' };

export function personCard(overrides: Partial<PersonCardData> = {}): PersonCardData {
  return {
    slug: 'g-batbayar',
    displayName: 'Г.Батбаяр',
    photo: null,
    role: 'УИХ-ын гишүүн',
    party,
    constituency: '1-р тойрог',
    ...overrides,
  };
}
