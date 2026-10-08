import 'server-only';
import type { PublicArticleSummary } from '@news/shared/schemas';
import type { Crumb } from '@/components/breadcrumbs';
import type { Correction } from '@/components/correction-notice';
import type { PartyRef } from '@/components/party-badge';
import type { PersonCardData } from '@/components/person-card';
import type { PublicMedia } from '@/lib/media';

// Fictional sample content for /styleguide only (people, parties and stories are made up).

/** Neutral gradient placeholder as a data URI (no binary assets). */
function placeholder(hue: number, width = 1024, height = 576): PublicMedia {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 35% 55%)"/><stop offset="1" stop-color="hsl(${hue + 40} 30% 30%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return { url, variants: [{ width, height, url }], alt: '', credit: null, width, height };
}

export const PANGRAM = 'Өглөө үүрээр Үнэгэн өндөр уулын өвөрт цасан шуурга шуурч, өвс ногоо цэцэглэв.';
export const GLYPH_LINE = 'Ө ө Ү ү — Өөрчлөлт, Үүрэг, Үндсэн хууль';
export const ALPHABET_UPPER = 'АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ';
export const ALPHABET_LOWER = 'абвгдеёжзийклмноөпрстуүфхцчшщъыьэюя 0123456789 «»—№';

export const TYPE_SAMPLES: { utility: string; text: string }[] = [
  { utility: 'type-display', text: 'Их Хурал 2027 оны төсвийг эцэслэн баталлаа' },
  { utility: 'type-headline', text: 'Үндсэн хуулийн өөрчлөлтийн төслийг хэлэлцэв' },
  { utility: 'type-title', text: 'Сонгуулийн хуулийн шинэчлэл: юу өөрчлөгдөх вэ' },
  { utility: 'type-lede', text: 'Засгийн газар өргөн мэдүүлсэн төслийг байнгын хорооны хуралдаанаар дэмжив.' },
  { utility: 'type-body', text: 'Төслийн дагуу аймаг, нийслэлийн төсвийн орлогын хуваарилалт өөрчлөгдөж, орон нутгийн хөгжлийн санд илүү их хөрөнгө төвлөрнө. Өмнөх оны гүйцэтгэлтэй харьцуулбал зардал үүнээс ч өсөх төлөвтэй.' },
  { utility: 'type-meta', text: '2026 оны 10-р сарын 7, 09:30 · 4 минут' },
  { utility: 'type-label', text: 'Улс төр' },
];

export const PARTIES: PartyRef[] = [
  { slug: 'mpp', nameMn: 'Монгол Ардын Нам', shortNameMn: 'МАН', color: '#C8102E' },
  { slug: 'dp', nameMn: 'Ардчилсан Нам', shortNameMn: 'АН', color: '#1F4E9C' },
  { slug: 'hun', nameMn: 'Хүн Нам', shortNameMn: 'ХҮН', color: '#F2A900' },
  { slug: 'independent', nameMn: 'Бие даагч', shortNameMn: null, color: null },
];

export const CATEGORY = { slug: 'uls-tor', nameMn: 'Улс төр', nameEn: null };

const base: Omit<PublicArticleSummary, 'id' | 'slug' | 'title'> = {
  lede: null,
  isBreaking: false,
  publishedAt: '2026-10-07T01:30:00.000Z',
  updatedAt: '2026-10-07T01:30:00.000Z',
  category: CATEGORY,
  cover: null,
};

export const ARTICLES: PublicArticleSummary[] = [
  {
    ...base,
    id: 101,
    slug: 'ikh-khural-tosviig-batlav',
    title: 'Их Хурал 2027 оны төсвийг эцэслэн баталлаа: орон нутгийн санхүүжилт 12 хувиар өсөв',
    lede: 'Төсвийн тодотголыг 76 гишүүнээс 51 нь дэмжиж, хөрөнгө оруулалтын жагсаалтад сүүлийн мөчид өөрчлөлт оров.',
    isBreaking: true,
    cover: placeholder(210),
  },
  { ...base, id: 102, slug: 'songuuliin-khuuli', title: 'Сонгуулийн хуулийн шинэчлэл: юу өөрчлөгдөх вэ', cover: placeholder(30), publishedAt: '2026-10-06T23:10:00.000Z' },
  {
    ...base,
    id: 103,
    slug: 'khorruptsiin-khereg',
    title: 'Авлигатай тэмцэх газар хоёр сайдын хөрөнгийн мэдүүлгийг шалгаж эхэллээ',
    category: { slug: 'shudarga-yos', nameMn: 'Шударга ёс', nameEn: null },
    cover: placeholder(150),
    publishedAt: '2026-10-06T08:45:00.000Z',
  },
  {
    ...base,
    id: 104,
    slug: 'ediin-zasgiin-toim',
    title: 'Эдийн засгийн тойм: инфляц 6.1 хувьд хүрэв',
    category: { slug: 'ediin-zasag', nameMn: 'Эдийн засаг', nameEn: null },
    publishedAt: '2026-10-05T04:00:00.000Z',
  },
  { ...base, id: 105, slug: 'zasgiin-gazriin-khural', title: 'Засгийн газрын ээлжит хуралдаанаар 14 асуудал хэлэлцэв', isBreaking: true, cover: placeholder(280, 320, 320), publishedAt: '2026-10-04T10:20:00.000Z' },
];

export const PEOPLE: PersonCardData[] = [
  { id: 1, slug: 'g-batbayar', displayName: 'Г.Батбаяр', photo: placeholder(200, 320, 320), role: 'УИХ-ын гишүүн', party: PARTIES[0]!, constituency: 'Сэлэнгэ аймаг, 3-р тойрог' },
  { id: 2, slug: 'd-sarantuya', displayName: 'Д.Сарантуяа', photo: null, role: 'Сангийн сайд', party: PARTIES[1]!, constituency: null },
  { id: 3, slug: 'ts-oyunbileg', displayName: 'Ц.Оюунбилэг', photo: null, role: 'Улсын Их Хурлын Төсвийн байнгын хорооны дарга, УИХ-ын гишүүн', party: PARTIES[3]!, constituency: 'Өвөрхангай аймаг, 9-р тойрог' },
];

export const TAGS = [
  { slug: 'tosov', nameMn: 'Төсөв' },
  { slug: 'songuul', nameMn: 'Сонгууль' },
  { slug: 'oyuu-tolgoi', nameMn: 'Оюу толгой' },
  { slug: 'avliga', nameMn: 'Авлига' },
];

export const CRUMBS: Crumb[] = [
  { label: 'Нүүр', href: '/' },
  { label: 'Хүмүүс', href: '/people' },
  { label: 'Улсын Их Хурлын Төсвийн байнгын хорооны дарга Ц.Оюунбилэг' },
];

export const CORRECTIONS: Correction[] = [
  { date: '2026-10-07', description: 'Батлагдсан төсвийн дүнг 25.1 их наяд төгрөг гэж засав.', reason: 'Тоог буруу бичсэн байсан' },
  { date: '2026-10-06', description: 'Гишүүний овгийг зөв бичив.', reason: 'Үсгийн алдаа' },
];

export const SOURCE_URL = 'https://www.parliament.mn/n/12345';
