import type { App } from '../app';
import { bills, organizations, persons } from '../db/schema/index';
import { insertArticle } from './articles';
import { createTestUser } from './factories';

export const SRC = 'https://source.example/test';

/** Rows the political-data resources reference. */
export async function seedRefs(app: App) {
  const [personA] = await app.db
    .insert(persons)
    .values({ slug: 'g-batbayar', givenNameMn: 'Батбаяр', patronymicMn: 'Ганболд' })
    .returning();
  const [personB] = await app.db
    .insert(persons)
    .values({ slug: 'd-sarantuya', givenNameMn: 'Сарантуяа', patronymicMn: 'Дорж' })
    .returning();
  const [party] = await app.db
    .insert(organizations)
    .values({ type: 'party', slug: 'mpp', nameMn: 'Монгол Ардын Нам', shortNameMn: 'МАН', color: '#C8102E' })
    .returning();
  const [bill] = await app.db
    .insert(bills)
    .values({ slug: 'tax-bill', titleMn: 'Татварын хуулийн төсөл', initiatorType: 'government', status: 'submitted', sourceUrl: SRC })
    .returning();
  const author = await createTestUser(app.db, { role: 'reporter', password: null });
  const article = await insertArticle(app, author.id, 'published');
  return { personA: personA!, personB: personB!, party: party!, bill: bill!, article, author };
}

export type Refs = Awaited<ReturnType<typeof seedRefs>>;

export interface ResourceSpec {
  name: string;
  path: string;
  entityType: string;
  /** Persons and organizations are soft-deleted by data editors; everything else is an admin-only hard delete. */
  softDelete: boolean;
  create: (refs: Refs) => Record<string, unknown>;
  update: Record<string, unknown>;
  /** A list query that must include the row after `update` has been applied. */
  filter: (refs: Refs) => string;
}

export const RESOURCES: ResourceSpec[] = [
  {
    name: 'persons',
    path: '/v1/admin/persons',
    entityType: 'person',
    softDelete: true,
    create: () => ({ givenNameMn: 'Тэмүүлэн', patronymicMn: 'Цэрэн' }),
    update: { bioMn: 'Шинэчилсэн намтар' },
    filter: () => `search=${encodeURIComponent('Тэмүүлэн')}`,
  },
  {
    name: 'organizations',
    path: '/v1/admin/organizations',
    entityType: 'organization',
    softDelete: true,
    create: () => ({ type: 'committee', nameMn: 'Төсвийн байнгын хороо', nameEn: 'Budget Committee' }),
    update: { shortNameMn: 'ТБХ' },
    filter: () => 'type=committee',
  },
  {
    name: 'positions',
    path: '/v1/admin/positions',
    entityType: 'position',
    softDelete: false,
    create: (r) => ({ personId: r.personA.id, organizationId: r.party.id, titleMn: 'Гишүүн', startDate: '2024-07-10', sourceUrl: SRC }),
    update: { endDate: '2025-01-01' },
    filter: (r) => `personId=${r.personA.id}`,
  },
  {
    name: 'bills',
    path: '/v1/admin/bills',
    entityType: 'bill',
    softDelete: false,
    create: () => ({ titleMn: 'Шинэ хуулийн төсөл', titleEn: 'New draft law', initiatorType: 'mps', status: 'submitted', sourceUrl: SRC }),
    update: { status: 'in_committee' },
    filter: () => 'status=in_committee',
  },
  {
    name: 'bill-stages',
    path: '/v1/admin/bill-stages',
    entityType: 'bill_stage',
    softDelete: false,
    create: (r) => ({ billId: r.bill.id, stage: 'submitted', date: '2025-03-10', sourceUrl: SRC }),
    update: { noteMn: 'Өргөн барив' },
    filter: (r) => `billId=${r.bill.id}`,
  },
  {
    name: 'votes',
    path: '/v1/admin/votes',
    entityType: 'vote',
    softDelete: false,
    create: (r) => ({ billId: r.bill.id, personId: r.personA.id, value: 'yes', date: '2025-04-17', motion: 'final_vote', sourceUrl: SRC }),
    update: { value: 'no' },
    filter: (r) => `billId=${r.bill.id}&motion=final_vote`,
  },
  {
    name: 'statements',
    path: '/v1/admin/statements',
    entityType: 'statement',
    softDelete: false,
    create: (r) => ({ personId: r.personA.id, quoteMn: 'Бид дэмжинэ.', saidOn: '2025-04-17', articleId: r.article.id, sourceUrl: SRC }),
    update: { contextMn: 'Нэгдсэн хуралдаан' },
    filter: (r) => `personId=${r.personA.id}`,
  },
  {
    name: 'promises',
    path: '/v1/admin/promises',
    entityType: 'promise',
    softDelete: false,
    create: (r) => ({ personId: r.personA.id, textMn: 'Татварыг цахимжуулна.', madeOn: '2024-06-10', sourceUrl: SRC }),
    update: { textMn: 'Татварыг бүрэн цахимжуулна.', evidence: [{ url: SRC, label: 'Хууль батлагдсан', date: '2025-04-17' }] },
    filter: (r) => `personId=${r.personA.id}&status=not_rated`,
  },
  {
    name: 'declarations',
    path: '/v1/admin/declarations',
    entityType: 'declaration',
    softDelete: false,
    create: (r) => ({ personId: r.personA.id, year: 2024, income: '48000000.00', sourceUrl: SRC }),
    update: { assets: '210000000.50' },
    filter: (r) => `personId=${r.personA.id}&year=2024`,
  },
  {
    name: 'corrections',
    path: '/v1/admin/corrections',
    entityType: 'correction',
    softDelete: false,
    create: (r) => ({ entityType: 'article', entityId: r.article.id, date: '2025-04-18', description: 'Тоог зассан', reason: 'Буруу тоо' }),
    update: { reason: 'Эх сурвалжийн алдаа' },
    filter: (r) => `entityType=article&entityId=${r.article.id}`,
  },
];
