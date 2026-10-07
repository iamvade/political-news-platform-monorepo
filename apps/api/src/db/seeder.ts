/**
 * Development seed data. Everything here is FICTIONAL: persons, quotes, votes, declarations and articles are
 * invented. Party names are real; sources point at the reserved `source.example` domain so seeded "facts" can
 * never be mistaken for real records. Article slugs start with `sample-`.
 */
import type { PromiseEvidence } from '@news/shared/schemas';
import { count } from 'drizzle-orm';
import type { Db } from './client';
import {
  articleBills,
  articleOrganizations,
  articlePersons,
  articleRevisions,
  articles,
  articleTags,
  bills,
  billSponsors,
  billStages,
  categories,
  corrections,
  declarations,
  media,
  organizations,
  persons,
  positions,
  promises,
  statements,
  tags,
  users,
  votes,
  type TiptapDoc,
} from './schema/index';

const src = (path: string) => `https://source.example/${path}`;

// ---------------------------------------------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------------------------------------------

const PARTIES = [
  { slug: 'mpp', nameMn: 'Монгол Ардын Нам', nameEn: "Mongolian People's Party", shortNameMn: 'МАН', color: '#C8102E' },
  { slug: 'dp', nameMn: 'Ардчилсан Нам', nameEn: 'Democratic Party', shortNameMn: 'АН', color: '#1F4E9C' },
  { slug: 'hun', nameMn: 'ХҮН Нам', nameEn: 'HUN Party', shortNameMn: 'ХҮН', color: '#E07B00' },
  {
    slug: 'national-coalition',
    nameMn: 'Үндэсний Эвсэл',
    nameEn: 'National Coalition',
    shortNameMn: 'ҮЭ',
    color: '#6B4FA0',
  },
  {
    slug: 'civil-will-green',
    nameMn: 'Иргэний Зориг-Ногоон Нам',
    nameEn: 'Civil Will–Green Party',
    shortNameMn: 'ИЗНН',
    color: '#2E8B57',
  },
] as const;

/** [patronymicMn, givenNameMn, patronymicEn, givenNameEn, gender, birthYear, partyIndex] */
const PERSONS: [string, string, string, string, 'male' | 'female', number, number][] = [
  ['Ганболд', 'Батбаяр', 'Ganbold', 'Batbayar', 'male', 1972, 0],
  ['Дорж', 'Сарантуяа', 'Dorj', 'Sarantuya', 'female', 1978, 0],
  ['Цэрэн', 'Тэмүүлэн', 'Tseren', 'Temuulen', 'male', 1985, 0],
  ['Лхагва', 'Номин', 'Lkhagva', 'Nomin', 'female', 1981, 0],
  ['Пүрэв', 'Мөнх-Очир', 'Purev', 'Munkh-Ochir', 'male', 1969, 0],
  ['Сүхбат', 'Ариунаа', 'Sukhbat', 'Ariunaa', 'female', 1987, 0],
  ['Нямаа', 'Билгүүн', 'Nyamaa', 'Bilguun', 'male', 1990, 0],
  ['Очир', 'Үүрцайх', 'Ochir', 'Uurtsaikh', 'female', 1983, 0],
  ['Жаргал', 'Тэргэл', 'Jargal', 'Tergel', 'male', 1976, 1],
  ['Баатар', 'Энхжин', 'Baatar', 'Enkhjin', 'female', 1988, 1],
  ['Мягмар', 'Ганзориг', 'Myagmar', 'Ganzorig', 'male', 1974, 1],
  ['Дашдондог', 'Солонго', 'Dashdondog', 'Solongo', 'female', 1984, 1],
  ['Ням', 'Өлзийбаяр', 'Nyam', 'Ulziibayar', 'male', 1979, 1],
  ['Түвшин', 'Хулан', 'Tuvshin', 'Khulan', 'female', 1986, 2],
  ['Ганхуяг', 'Бямбадорж', 'Gankhuyag', 'Byambadorj', 'male', 1982, 2],
  ['Энхтөр', 'Оюунчимэг', 'Enkhtur', 'Oyunchimeg', 'female', 1975, 2],
  ['Бат', 'Чинзориг', 'Bat', 'Chinzorig', 'male', 1971, 3],
  ['Алтан', 'Мөнхзул', 'Altan', 'Munkhzul', 'female', 1980, 3],
  ['Сэргэлэн', 'Дөлгөөн', 'Sergelen', 'Dulguun', 'male', 1989, 4],
  ['Хишиг', 'Анужин', 'Khishig', 'Anujin', 'female', 1991, 4],
];

/** Persons 0–15 are MPs; 0–11 hold constituency seats, 12–15 party-list seats. */
const MP_COUNT = 16;
const CONSTITUENCY_MP_COUNT = 12;
const TERM_START = '2024-07-02';

const CATEGORIES = [
  { slug: 'politics', nameMn: 'Улс төр', nameEn: 'Politics' },
  { slug: 'economy', nameMn: 'Эдийн засаг', nameEn: 'Economy' },
  { slug: 'law', nameMn: 'Хууль, эрх зүй', nameEn: 'Law' },
  { slug: 'society', nameMn: 'Нийгэм', nameEn: 'Society' },
  { slug: 'opinion', nameMn: 'Санал бодол', nameEn: 'Opinion' },
] as const;

const TAGS = [
  { slug: 'tax', nameMn: 'Татвар', nameEn: 'Tax' },
  { slug: 'budget', nameMn: 'Төсөв', nameEn: 'Budget' },
  { slug: 'health', nameMn: 'Эрүүл мэнд', nameEn: 'Health' },
  { slug: 'transparency', nameMn: 'Ил тод байдал', nameEn: 'Transparency' },
  { slug: 'coalition', nameMn: 'Эвслийн засгийн газар', nameEn: 'Coalition government' },
  { slug: 'plenary-session', nameMn: 'Нэгдсэн хуралдаан', nameEn: 'Plenary session' },
  { slug: 'asset-declarations', nameMn: 'Хөрөнгийн мэдүүлэг', nameEn: 'Asset declarations' },
  { slug: 'elections-2028', nameMn: '2028 оны сонгууль', nameEn: '2028 elections' },
] as const;

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Builds a Tiptap document and its matching HTML from plain paragraphs. */
function body(paragraphs: string[]): { bodyJson: TiptapDoc; bodyHtml: string } {
  return {
    bodyJson: {
      type: 'doc',
      content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
    },
    bodyHtml: paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''),
  };
}

function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`Seed data index ${index} out of range`);
  return item;
}

function personSlug(patronymicEn: string, givenNameEn: string): string {
  return `${patronymicEn[0]}-${givenNameEn}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** Deterministic vote pattern: governing parties (MPP, HUN) mostly yes, others mixed. */
function voteFor(partyIndex: number, personIndex: number, motionIndex: number) {
  if ((personIndex + motionIndex) % 7 === 3) return 'absent' as const;
  if (partyIndex === 0 || partyIndex === 2) return 'yes' as const;
  return (['no', 'abstain', 'yes'] as const)[(personIndex + motionIndex) % 3]!;
}

export class SeedRefusedError extends Error {}

export interface SeedCounts {
  users: number;
  organizations: number;
  persons: number;
  positions: number;
  bills: number;
  votes: number;
  statements: number;
  promises: number;
  declarations: number;
  articles: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------------------------------------------

/** Inserts the sample data in one transaction. Throws SeedRefusedError if the database already has data. */
export async function seed(db: Db): Promise<SeedCounts> {
  const [existing] = await db.select({ n: count() }).from(users);
  if (existing && existing.n > 0) {
    throw new SeedRefusedError('Database already has data. Re-run with --reset to wipe it first.');
  }

  return db.transaction(async (tx) => {
    // Users -----------------------------------------------------------------------------------------------------
    const [admin, editor, reporter] = await tx
      .insert(users)
      .values([
        { email: 'admin@newsroom.example', role: 'admin', displayName: 'Систем админ' },
        { email: 'editor@newsroom.example', role: 'editor', displayName: 'Б.Сараа' },
        { email: 'reporter@newsroom.example', role: 'reporter', displayName: 'Т.Гэрэл' },
      ])
      .returning({ id: users.id });
    if (!admin || !editor || !reporter) throw new Error('User insert failed');

    // Media -----------------------------------------------------------------------------------------------------
    const mediaRows = await tx
      .insert(media)
      .values(
        [1, 2, 3].map((n) => ({
          r2Key: `seed/2025/sample-cover-${n}.jpg`,
          mime: 'image/jpeg',
          status: 'ready' as const,
          width: 1600,
          height: 900,
          byteSize: 240_000 + n * 1000,
          alt: `Төрийн ордны гадна талын зураг ${n}`,
          credit: 'Жишээ зураг',
          variants: {
            w640_webp: { key: `seed/2025/sample-cover-${n}-640.webp`, width: 640, height: 360, mime: 'image/webp' },
          },
          uploadedBy: reporter.id,
        })),
      )
      .returning({ id: media.id });

    // Taxonomy --------------------------------------------------------------------------------------------------
    const categoryRows = await tx
      .insert(categories)
      .values(CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })))
      .returning({ id: categories.id });
    const tagRows = await tx.insert(tags).values([...TAGS]).returning({ id: tags.id });
    const categoryId = (i: number) => at(categoryRows, i).id;
    const tagId = (i: number) => at(tagRows, i).id;

    // Organizations ---------------------------------------------------------------------------------------------
    const partyRows = await tx
      .insert(organizations)
      .values(PARTIES.map((p) => ({ ...p, type: 'party' as const })))
      .returning({ id: organizations.id });

    const [parliament] = await tx
      .insert(organizations)
      .values({
        type: 'parliament',
        slug: 'state-great-khural',
        nameMn: 'Улсын Их Хурал',
        nameEn: 'State Great Khural',
        shortNameMn: 'УИХ',
      })
      .returning({ id: organizations.id });
    if (!parliament) throw new Error('Parliament insert failed');

    const committeeRows = await tx
      .insert(organizations)
      .values([
        { slug: 'budget-committee', nameMn: 'Төсвийн байнгын хороо', nameEn: 'Budget Standing Committee' },
        { slug: 'legal-committee', nameMn: 'Хууль зүйн байнгын хороо', nameEn: 'Legal Affairs Standing Committee' },
        { slug: 'economic-committee', nameMn: 'Эдийн засгийн байнгын хороо', nameEn: 'Economic Standing Committee' },
      ].map((c) => ({ ...c, type: 'committee' as const, parentId: parliament.id })))
      .returning({ id: organizations.id });

    const [financeMinistry, healthMinistry] = await tx
      .insert(organizations)
      .values([
        { type: 'ministry', slug: 'ministry-of-finance', nameMn: 'Сангийн яам', nameEn: 'Ministry of Finance' },
        { type: 'ministry', slug: 'ministry-of-health', nameMn: 'Эрүүл мэндийн яам', nameEn: 'Ministry of Health' },
      ])
      .returning({ id: organizations.id });
    if (!financeMinistry || !healthMinistry) throw new Error('Ministry insert failed');

    const [taxAgency] = await tx
      .insert(organizations)
      .values({
        type: 'agency',
        slug: 'general-tax-authority',
        nameMn: 'Татварын ерөнхий газар',
        nameEn: 'General Tax Authority',
        parentId: financeMinistry.id,
      })
      .returning({ id: organizations.id });
    if (!taxAgency) throw new Error('Agency insert failed');

    const constituencyRows = await tx
      .insert(organizations)
      .values(
        [1, 2, 3, 4].map((n) => ({
          type: 'constituency' as const,
          slug: `constituency-${n}-2024`,
          nameMn: `${n}-р тойрог (2024–2028)`,
          nameEn: `Constituency ${n} (2024–2028)`,
          parentId: parliament.id,
        })),
      )
      .returning({ id: organizations.id });

    // Persons ---------------------------------------------------------------------------------------------------
    const personRows = await tx
      .insert(persons)
      .values(
        PERSONS.map(([patronymicMn, givenNameMn, patronymicEn, givenNameEn, gender, birthYear], i) => ({
          slug: personSlug(patronymicEn, givenNameEn),
          givenNameMn,
          patronymicMn,
          givenNameEn,
          patronymicEn,
          gender,
          birthDate: `${birthYear}-0${(i % 9) + 1}-15`,
          photoMediaId: i === 0 ? at(mediaRows, 2).id : null,
          bioMn: `${patronymicMn}.${givenNameMn} нь жишээ өгөгдөлд зориулсан зохиомол хүн юм.`,
        })),
      )
      .returning({ id: persons.id });
    const personId = (i: number) => at(personRows, i).id;
    const partyOf = (i: number) => at(PERSONS, i)[6];

    // Positions -------------------------------------------------------------------------------------------------
    const positionValues: (typeof positions.$inferInsert)[] = [];
    PERSONS.forEach((_, i) => {
      positionValues.push({
        personId: personId(i),
        organizationId: at(partyRows, partyOf(i)).id,
        titleMn: 'Гишүүн',
        titleEn: 'Member',
        startDate: `${2000 + (i % 15)}-03-01`,
        sourceUrl: src(`parties/members/${i + 1}`),
      });
      if (i < MP_COUNT) {
        positionValues.push({
          personId: personId(i),
          organizationId: i < CONSTITUENCY_MP_COUNT ? at(constituencyRows, i % 4).id : parliament.id,
          titleMn: 'УИХ-ын гишүүн',
          titleEn: 'Member of Parliament',
          startDate: TERM_START,
          sourceUrl: src(`parliament/members/${i + 1}`),
        });
      }
      if (i < 12) {
        const isChair = i < 3;
        positionValues.push({
          personId: personId(i),
          organizationId: at(committeeRows, i % 3).id,
          titleMn: isChair ? 'Дарга' : 'Гишүүн',
          titleEn: isChair ? 'Chair' : 'Member',
          startDate: '2024-07-10',
          sourceUrl: src(`parliament/committees/${(i % 3) + 1}`),
        });
      }
    });
    positionValues.push(
      {
        personId: personId(1),
        organizationId: financeMinistry.id,
        titleMn: 'Сангийн сайд',
        titleEn: 'Minister of Finance',
        startDate: '2024-07-10',
        sourceUrl: src('government/appointments/finance'),
      },
      {
        personId: personId(13),
        organizationId: healthMinistry.id,
        titleMn: 'Эрүүл мэндийн сайд',
        titleEn: 'Minister of Health',
        startDate: '2024-07-10',
        sourceUrl: src('government/appointments/health'),
      },
      {
        // Former minister: a closed position for timeline display.
        personId: personId(17),
        organizationId: healthMinistry.id,
        titleMn: 'Эрүүл мэндийн сайд',
        titleEn: 'Minister of Health',
        startDate: '2022-01-15',
        endDate: '2024-07-10',
        sourceUrl: src('government/appointments/health-2022'),
      },
      {
        personId: personId(16),
        organizationId: taxAgency.id,
        titleMn: 'Дарга',
        titleEn: 'Head',
        startDate: '2023-09-01',
        sourceUrl: src('government/appointments/tax-authority'),
      },
    );
    await tx.insert(positions).values(positionValues);

    // Bills, sponsors, stages -----------------------------------------------------------------------------------
    const [taxBill, healthBill, transparencyBill] = await tx
      .insert(bills)
      .values([
        {
          slug: 'tax-general-law-amendment-2025',
          titleMn: 'Татварын ерөнхий хуульд нэмэлт, өөрчлөлт оруулах тухай хуулийн төсөл',
          titleEn: 'Draft amendment to the General Law on Taxation',
          registrationNumber: 'SAMPLE-2025-014',
          initiatorType: 'government',
          status: 'passed',
          submittedOn: '2025-03-10',
          sourceUrl: src('bills/sample-2025-014'),
        },
        {
          slug: 'health-insurance-amendment-2025',
          titleMn: 'Эрүүл мэндийн даатгалын тухай хуульд өөрчлөлт оруулах тухай хуулийн төсөл',
          titleEn: 'Draft amendment to the Law on Health Insurance',
          registrationNumber: 'SAMPLE-2025-031',
          initiatorType: 'government',
          status: 'in_plenary',
          submittedOn: '2025-05-12',
          sourceUrl: src('bills/sample-2025-031'),
        },
        {
          slug: 'public-information-transparency-amendment-2025',
          titleMn: 'Нийтийн мэдээллийн ил тод байдлын тухай хуульд нэмэлт оруулах тухай хуулийн төсөл',
          titleEn: 'Draft amendment to the Law on Transparency of Public Information',
          registrationNumber: 'SAMPLE-2025-047',
          initiatorType: 'mps',
          status: 'rejected',
          submittedOn: '2025-06-02',
          sourceUrl: src('bills/sample-2025-047'),
        },
      ])
      .returning({ id: bills.id });
    if (!taxBill || !healthBill || !transparencyBill) throw new Error('Bill insert failed');

    await tx.insert(billSponsors).values([
      { billId: taxBill.id, personId: personId(1), role: 'initiator' },
      { billId: healthBill.id, personId: personId(13), role: 'initiator' },
      { billId: transparencyBill.id, personId: personId(8), role: 'initiator' },
      { billId: transparencyBill.id, personId: personId(10), role: 'co_sponsor' },
      { billId: transparencyBill.id, personId: personId(14), role: 'co_sponsor' },
    ]);

    const stage = (billId: number, s: typeof billStages.$inferInsert.stage, date: string, path: string) => ({
      billId,
      stage: s,
      date,
      sourceUrl: src(path),
    });
    await tx.insert(billStages).values([
      stage(taxBill.id, 'submitted', '2025-03-10', 'bills/sample-2025-014/submitted'),
      stage(taxBill.id, 'consideration', '2025-03-20', 'bills/sample-2025-014/consideration'),
      stage(taxBill.id, 'first_reading', '2025-04-03', 'bills/sample-2025-014/first-reading'),
      stage(taxBill.id, 'final_reading', '2025-04-17', 'bills/sample-2025-014/final-reading'),
      stage(taxBill.id, 'passed', '2025-04-17', 'bills/sample-2025-014/passed'),
      stage(healthBill.id, 'submitted', '2025-05-12', 'bills/sample-2025-031/submitted'),
      stage(healthBill.id, 'consideration', '2025-05-29', 'bills/sample-2025-031/consideration'),
      stage(healthBill.id, 'first_reading', '2025-06-19', 'bills/sample-2025-031/first-reading'),
      stage(transparencyBill.id, 'submitted', '2025-06-02', 'bills/sample-2025-047/submitted'),
      stage(transparencyBill.id, 'consideration', '2025-06-26', 'bills/sample-2025-047/consideration'),
      stage(transparencyBill.id, 'rejected', '2025-06-26', 'bills/sample-2025-047/rejected'),
    ]);

    // Votes: every MP on each recorded motion -------------------------------------------------------------------
    const motions = [
      { billId: taxBill.id, date: '2025-03-20', motion: 'consideration', path: 'votes/sample-2025-014/consideration' },
      { billId: taxBill.id, date: '2025-04-17', motion: 'final_vote', path: 'votes/sample-2025-014/final' },
      { billId: healthBill.id, date: '2025-05-29', motion: 'consideration', path: 'votes/sample-2025-031/consideration' },
      {
        billId: transparencyBill.id,
        date: '2025-06-26',
        motion: 'consideration',
        path: 'votes/sample-2025-047/consideration',
      },
    ];
    const voteValues = motions.flatMap((m, motionIndex) =>
      Array.from({ length: MP_COUNT }, (_, i) => ({
        billId: m.billId,
        personId: personId(i),
        value: voteFor(partyOf(i), i, motionIndex),
        date: m.date,
        motion: m.motion,
        sourceUrl: src(m.path),
      })),
    );
    await tx.insert(votes).values(voteValues);

    // Articles + revisions + tags -------------------------------------------------------------------------------
    type ArticleSeed = {
      slug: string;
      title: string;
      lede: string;
      paragraphs: string[];
      status: typeof articles.$inferInsert.status;
      publishedAt?: Date;
      scheduledAt?: Date;
      author: number;
      category: number;
      cover?: number;
      isBreaking?: boolean;
      persons: number[];
      orgs: number[];
      bills: number[];
      tags: number[];
    };
    const day = (iso: string) => new Date(`${iso}T09:00:00+08:00`);
    const ARTICLES: ArticleSeed[] = [
      {
        slug: 'sample-tax-law-amendment-passed',
        title: 'УИХ Татварын ерөнхий хуулийн нэмэлт, өөрчлөлтийг баталлаа',
        lede: 'Нэгдсэн хуралдаанаар хуулийн төслийг эцсийн хэлэлцүүлгээр баталлаа.',
        paragraphs: [
          'Улсын Их Хурлын нэгдсэн хуралдаан Татварын ерөнхий хуульд нэмэлт, өөрчлөлт оруулах тухай хуулийн төслийг эцсийн хэлэлцүүлгээр баталлаа.',
          'Сангийн сайд Д.Сарантуяа хуулийн өөрчлөлт нь татвар төлөгчдийн тайлагналыг хялбарчилна гэж мэдэгдэв.',
          'Энэ нийтлэл нь жишээ өгөгдөл бөгөөд бодит үйл явдлыг тусгаагүй болно.',
        ],
        status: 'published',
        publishedAt: day('2025-04-17'),
        author: reporter.id,
        category: 1,
        cover: 0,
        isBreaking: true,
        persons: [1],
        orgs: [0],
        bills: [0],
        tags: [0, 5],
      },
      {
        slug: 'sample-tax-bill-first-reading',
        title: 'Татварын хуулийн төслийн анхны хэлэлцүүлэг үргэлжилж байна',
        lede: 'Төсвийн байнгын хороо төслийг дэмжсэн санал дүгнэлтээ танилцууллаа.',
        paragraphs: [
          'Төсвийн байнгын хорооны дарга Г.Батбаяр хорооны санал, дүгнэлтийг нэгдсэн хуралдаанд танилцууллаа.',
          'Зарим гишүүд жижиг, дунд бизнест үзүүлэх нөлөөг нарийвчлан судлах шаардлагатай гэж үзэв.',
        ],
        status: 'published',
        publishedAt: day('2025-04-03'),
        author: reporter.id,
        category: 1,
        persons: [0, 8],
        orgs: [6],
        bills: [0],
        tags: [0, 1],
      },
      {
        slug: 'sample-health-insurance-bill-submitted',
        title: 'Засгийн газар Эрүүл мэндийн даатгалын хуулийн өөрчлөлтийг өргөн барилаа',
        lede: 'Төсөлд даатгалын санхүүжилтийн шинэ зохицуулалт тусгагджээ.',
        paragraphs: [
          'Эрүүл мэндийн сайд Т.Хулан хуулийн төслийг Улсын Их Хуралд өргөн барилаа.',
          'Төслийн дагуу даатгалын сангийн зарцуулалтын тайланг улирал бүр нийтэд ил болгоно.',
        ],
        status: 'published',
        publishedAt: day('2025-05-12'),
        author: editor.id,
        category: 3,
        cover: 1,
        persons: [13],
        orgs: [2],
        bills: [1],
        tags: [2, 4],
      },
      {
        slug: 'sample-transparency-bill-rejected',
        title: 'Ил тод байдлын хуулийн нэмэлтийг хэлэлцэхийг дэмжсэнгүй',
        lede: 'Гишүүдийн санаачилсан төслийг хэлэлцэх эсэх асуудлыг олонхын саналаар буцаалаа.',
        paragraphs: [
          'УИХ-ын гишүүн Ж.Тэргэл тэргүүтэй гишүүдийн санаачилсан хуулийн төслийг хэлэлцэх эсэх асуудлаар санал хураалт явуулав.',
          'Санаачлагчид төслөө боловсронгуй болгож дахин өргөн барина гэж мэдэгдлээ.',
        ],
        status: 'published',
        publishedAt: day('2025-06-26'),
        author: reporter.id,
        category: 2,
        persons: [8, 10, 14],
        orgs: [1],
        bills: [2],
        tags: [3, 5],
      },
      {
        slug: 'sample-asset-declarations-published',
        title: 'Улс төрчдийн 2024 оны хөрөнгө, орлогын мэдүүлэг нийтлэгдлээ',
        lede: 'Мэдүүлгийн нэгтгэлийг профайл хуудсуудад байршууллаа.',
        paragraphs: [
          'Жишээ өгөгдлийн хүрээнд 20 улс төрчийн 2024 оны хөрөнгө, орлогын мэдүүлгийн гол үзүүлэлтийг нэгтгэлээ.',
          'Мэдүүлэг бүрийн эх сурвалжийн холбоосыг профайл хуудаснаас үзэх боломжтой.',
        ],
        status: 'published',
        publishedAt: day('2025-07-08'),
        author: editor.id,
        category: 0,
        persons: [0, 1, 4, 13],
        orgs: [],
        bills: [],
        tags: [6],
      },
      {
        slug: 'sample-coalition-government-one-year',
        title: 'Эвслийн Засгийн газар нэг жилийн хугацаанд юу хийв',
        lede: 'Амлалтуудын биелэлтийг эх сурвалжтай нь нэгтгэн харууллаа.',
        paragraphs: [
          'Эвслийн Засгийн газар байгуулагдсаны нэг жилийн ой тохиож байна.',
          'Бид амлалт бүрийн биелэлтийг нотлох баримт, эх сурвалжийн хамт үнэллээ.',
        ],
        status: 'published',
        publishedAt: day('2025-07-10'),
        author: editor.id,
        category: 0,
        cover: 2,
        persons: [1, 13],
        orgs: [0, 2],
        bills: [],
        tags: [4],
      },
      {
        slug: 'sample-opinion-committee-hearings',
        title: 'Санал бодол: Байнгын хорооны сонсголыг нээлттэй болгох цаг болсон',
        lede: 'Хорооны хуралдааны бичлэгийг бүрэн нийтлэх нь итгэлцлийг нэмэгдүүлнэ.',
        paragraphs: [
          'Байнгын хорооны хуралдаанууд хууль тогтоох үйл явцын хамгийн чухал үе шат хэвээр байна.',
          'Энэ нь зохиогчийн хувийн байр суурь бөгөөд жишээ өгөгдөл юм.',
        ],
        status: 'published',
        publishedAt: day('2025-08-01'),
        author: reporter.id,
        category: 4,
        persons: [],
        orgs: [],
        bills: [],
        tags: [3],
      },
      {
        slug: 'sample-budget-2026-draft',
        title: '2026 оны төсвийн төслийн гол үзүүлэлтүүд',
        lede: 'Сангийн яам төсвийн төслийг Засгийн газрын хуралдаанд танилцуулна.',
        paragraphs: ['Төсвийн төслийн нарийвчилсан тоо баримтыг удахгүй нэмнэ.'],
        status: 'draft',
        author: reporter.id,
        category: 1,
        persons: [1],
        orgs: [],
        bills: [],
        tags: [1],
      },
      {
        slug: 'sample-elections-2028-preparations',
        title: '2028 оны сонгуульд намууд хэрхэн бэлтгэж байна вэ',
        lede: 'Намуудын дотоод сонгон шалгаруулалтын журам өөрчлөгдөж байна.',
        paragraphs: ['Нийтлэл редакторын хяналтад байна.'],
        status: 'in_review',
        author: reporter.id,
        category: 0,
        persons: [16, 18],
        orgs: [3, 4],
        bills: [],
        tags: [7],
      },
      {
        slug: 'sample-autumn-session-preview',
        title: 'Намрын чуулганаар хэлэлцэх асуудлууд',
        lede: 'Чуулганы хуралдааны төлөвлөгөөг урьдчилан танилцуулж байна.',
        paragraphs: ['Намрын ээлжит чуулганаар хэлэлцэх хуулийн төслүүдийн жагсаалт.'],
        status: 'scheduled',
        scheduledAt: new Date('2026-12-01T01:00:00Z'),
        author: editor.id,
        category: 0,
        persons: [],
        orgs: [],
        bills: [1],
        tags: [5],
      },
    ];

    const billIds = [taxBill.id, healthBill.id, transparencyBill.id];
    /** Organizations articles can be tagged with: parties 0–4, parliament 5, committees 6–8. */
    const taggableOrgs = [...partyRows, parliament, ...committeeRows];
    const articleRows: { id: number }[] = [];
    for (const a of ARTICLES) {
      const { bodyJson, bodyHtml } = body(a.paragraphs);
      const [row] = await tx
        .insert(articles)
        .values({
          title: a.title,
          slug: a.slug,
          lede: a.lede,
          bodyJson,
          bodyHtml,
          status: a.status,
          publishedAt: a.publishedAt,
          scheduledAt: a.scheduledAt,
          authorId: a.author,
          coverMediaId: a.cover === undefined ? null : at(mediaRows, a.cover).id,
          categoryId: categoryId(a.category),
          isBreaking: a.isBreaking ?? false,
        })
        .returning({ id: articles.id });
      if (!row) throw new Error('Article insert failed');
      articleRows.push(row);

      await tx.insert(articleRevisions).values({
        articleId: row.id,
        editorId: a.author,
        kind: 'create',
        snapshot: { title: a.title, slug: a.slug, lede: a.lede, bodyJson, status: a.status },
      });
      if (a.persons.length)
        await tx.insert(articlePersons).values(a.persons.map((p) => ({ articleId: row.id, personId: personId(p) })));
      if (a.orgs.length)
        await tx
          .insert(articleOrganizations)
          .values(a.orgs.map((o) => ({ articleId: row.id, organizationId: at(taggableOrgs, o).id })));
      if (a.bills.length)
        await tx.insert(articleBills).values(a.bills.map((b) => ({ articleId: row.id, billId: at(billIds, b) })));
      if (a.tags.length)
        await tx.insert(articleTags).values(a.tags.map((t) => ({ articleId: row.id, tagId: tagId(t) })));
    }

    // Statements ------------------------------------------------------------------------------------------------
    const STATEMENTS: [number, string, string, string, number | null][] = [
      [1, 'Татварын тайлагналыг цахимжуулснаар бизнес эрхлэгчдийн цагийг хэмнэнэ.', 'Нэгдсэн хуралдаан', '2025-04-17', 0],
      [0, 'Хорооны зүгээс төслийг дэмжих санал гаргаж байна.', 'Төсвийн байнгын хорооны хуралдаан', '2025-04-02', 1],
      [8, 'Ил тод байдлын хуулийг сайжруулахгүйгээр авлигатай тэмцэх боломжгүй.', 'Хэвлэлийн бага хурал', '2025-06-03', null],
      [10, 'Бид төслөө дахин боловсруулж өргөн барина.', 'Нэгдсэн хуралдааны дараах ярилцлага', '2025-06-26', 3],
      [13, 'Даатгалын сангийн зарцуулалт улирал бүр нийтэд ил болно.', 'Засгийн газрын хуралдаан', '2025-05-12', 2],
      [4, 'Орон нутгийн хөгжлийн санг нэмэгдүүлэх шаардлагатай.', 'Тойргийн иргэдтэй хийсэн уулзалт', '2025-05-20', null],
      [9, 'Хорооны хуралдааны бичлэгийг бүрэн нийтлэх ёстой.', 'Фэйсбүүк хуудсанд нийтэлсэн бичлэг', '2025-07-30', null],
      [14, 'Эвслийн гэрээний заалт бүрийг хэрэгжүүлнэ.', 'Хэвлэлийн бага хурал', '2025-07-10', 5],
      [16, 'Татварын буцаан олголтыг 30 хоногт багтаан шийдвэрлэнэ.', 'Хэвлэлийн мэдээ', '2025-02-14', null],
      [19, 'Ногоон эдийн засгийн бодлогыг төсөвт тусгах хэрэгтэй.', 'Олон нийтийн хэлэлцүүлэг', '2025-08-12', null],
    ];
    await tx.insert(statements).values(
      STATEMENTS.map(([p, quoteMn, contextMn, saidOn, articleIndex], i) => ({
        personId: personId(p),
        quoteMn,
        contextMn,
        saidOn,
        articleId: articleIndex === null ? null : at(articleRows, articleIndex).id,
        sourceUrl: src(`statements/${i + 1}`),
      })),
    );

    // Promises --------------------------------------------------------------------------------------------------
    const evidence = (path: string, label: string, date: string): PromiseEvidence[] => [
      { url: src(path), label, date },
    ];
    const reviewed = new Date('2025-09-01T00:00:00Z');
    await tx.insert(promises).values([
      {
        personId: personId(1),
        textMn: 'Татварын тайлагналыг бүрэн цахимжуулна.',
        madeOn: '2024-06-10',
        status: 'kept',
        evidence: evidence('evidence/tax-e-filing', 'Хууль батлагдсан', '2025-04-17'),
        lastReviewedAt: reviewed,
        sourceUrl: src('promises/1'),
      },
      {
        personId: personId(13),
        textMn: 'Эрүүл мэндийн даатгалын сангийн зарцуулалтыг ил тод болгоно.',
        madeOn: '2024-06-12',
        status: 'in_progress',
        evidence: evidence('evidence/health-bill', 'Хуулийн төсөл өргөн барьсан', '2025-05-12'),
        lastReviewedAt: reviewed,
        sourceUrl: src('promises/2'),
      },
      {
        personId: personId(8),
        textMn: 'Нийтийн мэдээллийн ил тод байдлын хуулийг шинэчилнэ.',
        madeOn: '2024-06-05',
        status: 'broken',
        evidence: evidence('evidence/transparency-rejected', 'Төслийг хэлэлцэхийг дэмжээгүй', '2025-06-26'),
        lastReviewedAt: reviewed,
        sourceUrl: src('promises/3'),
      },
      {
        personId: personId(4),
        textMn: 'Тойргийн бүх сургуулийг шинэчилнэ.',
        madeOn: '2024-06-08',
        status: 'not_rated',
        sourceUrl: src('promises/4'),
      },
      {
        organizationId: at(partyRows, 0).id,
        textMn: 'Улсын төсвийн алдагдлыг ДНБ-ий 2 хувиас бууруулна.',
        madeOn: '2024-05-20',
        status: 'in_progress',
        evidence: evidence('evidence/budget-execution', 'Төсвийн гүйцэтгэлийн тайлан', '2025-08-15'),
        lastReviewedAt: reviewed,
        sourceUrl: src('promises/5'),
      },
      {
        organizationId: at(partyRows, 1).id,
        textMn: 'Байнгын хорооны бүх хуралдааныг шууд дамжуулна.',
        madeOn: '2024-05-22',
        status: 'not_rated',
        sourceUrl: src('promises/6'),
      },
    ]);

    // Declarations (2024, everyone) -----------------------------------------------------------------------------
    await tx.insert(declarations).values(
      PERSONS.map((_, i) => ({
        personId: personId(i),
        year: 2024,
        filedOn: '2025-02-15',
        income: (48_000_000 + i * 3_250_000).toFixed(2),
        assets: (210_000_000 + i * 17_500_000).toFixed(2),
        liabilities: (i % 4 === 0 ? 35_000_000 + i * 1_000_000 : 0).toFixed(2),
        details: { realEstateCount: 1 + (i % 3), vehicleCount: i % 2 },
        sourceUrl: src(`declarations/2024/${i + 1}`),
      })),
    );

    // Correction ------------------------------------------------------------------------------------------------
    await tx.insert(corrections).values({
      entityType: 'article',
      entityId: at(articleRows, 1).id,
      date: '2025-04-04',
      description: 'Хорооны даргын овгийн үсгийг зассан.',
      reason: 'Нэрийн алдаа',
      createdBy: editor.id,
    });

    return {
      users: 3,
      organizations: partyRows.length + 1 + committeeRows.length + 2 + 1 + constituencyRows.length,
      persons: personRows.length,
      positions: positionValues.length,
      bills: billIds.length,
      votes: voteValues.length,
      statements: STATEMENTS.length,
      promises: 6,
      declarations: PERSONS.length,
      articles: articleRows.length,
    };
  });
}
