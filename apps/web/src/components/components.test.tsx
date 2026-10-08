import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { articleSummary, party, personCard } from '@/test/fixtures';
import { renderWithIntl } from '@/test/render';
import { ArticleCard } from './article-card';
import { Breadcrumbs } from './breadcrumbs';
import { CorrectionNotice } from './correction-notice';
import { Pagination } from './pagination';
import { PartyBadge } from './party-badge';
import { PersonCard } from './person-card';
import { RelatedArticles, RelatedArticlesSkeleton } from './related-articles';
import { SectionArticles, SectionArticlesSkeleton, SectionHeader } from './section-articles';
import { SourceLink, sourceHost } from './source-link';
import { Tag } from './tag';

describe('ArticleCard', () => {
  it('lead: headline link, lede, labels, eager responsive image and Ulaanbaatar time', () => {
    renderWithIntl(<ArticleCard article={articleSummary({ isBreaking: true })} size="lead" priority headingLevel={2} />);

    const link = screen.getByRole('link', { name: 'Их Хурал 2027 оны төсвийг баталлаа' });
    expect(link).toHaveAttribute('href', '/news/42-ikh-khural-tosviig-batlav');
    expect(screen.getByRole('heading', { level: 2 })).toContainElement(link);
    expect(screen.getByText('Үндсэн хуулийн өөрчлөлтийн төслийг эцсийн хэлэлцүүлэгт оруулав.')).toBeInTheDocument();
    expect(screen.getByText('Шуурхай')).toBeInTheDocument();
    expect(screen.getByText('Улс төр')).toBeInTheDocument();
    const img = document.querySelector('img')!;
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img.getAttribute('srcset')).toContain('a-320.webp 320w');
    expect(img).toHaveAttribute('alt', '');
    // 01:30 UTC = 09:30 in Ulaanbaatar.
    expect(screen.getByText(/09:30/)).toHaveAttribute('dateTime', '2026-10-07T01:30:00.000Z');
  });

  it('standard: no lede, lazy image; compact: thumbnail beside the headline', () => {
    const { unmount } = renderWithIntl(<ArticleCard article={articleSummary()} />);
    expect(screen.queryByText(/эцсийн хэлэлцүүлэгт/)).not.toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('loading', 'lazy');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    unmount();

    renderWithIntl(<ArticleCard article={articleSummary()} size="compact" />);
    expect(document.querySelector('img')).toHaveAttribute('sizes', '72px');
  });

  it('renders without a cover image', () => {
    renderWithIntl(<ArticleCard article={articleSummary({ cover: null, category: null })} size="lead" />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });
});

describe('PartyBadge', () => {
  it('always writes the name; colour is only a decorative dot', () => {
    renderWithIntl(<PartyBadge party={party} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/party/mpp');
    expect(link).toHaveTextContent('МАН');
    expect(link).toHaveAccessibleName('Монгол Ардын Нам');
    expect(link.querySelector('[aria-hidden] ')).toBeTruthy();
    expect((link.querySelector('span[style]') as HTMLElement).style.backgroundColor).toBe('rgb(200, 16, 46)');
  });

  it('ignores invalid colours and can render without a link', () => {
    renderWithIntl(<PartyBadge party={{ ...party, color: 'red;background:url(x)' }} link={false} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('span[style]')).toBeNull();
    expect(screen.getByText('МАН')).toBeInTheDocument();
  });
});

describe('PersonCard', () => {
  it('links the whole card to the profile and shows role, party and constituency', () => {
    renderWithIntl(<PersonCard person={personCard()} />);
    expect(screen.getByRole('link', { name: 'Г.Батбаяр' })).toHaveAttribute('href', '/person/12-g-batbayar');
    expect(screen.getAllByRole('link')).toHaveLength(1); // the party badge is not a nested link
    expect(screen.getByText('УИХ-ын гишүүн')).toBeInTheDocument();
    expect(screen.getByText('МАН')).toBeInTheDocument();
    expect(screen.getByText('1-р тойрог')).toBeInTheDocument();
    expect(screen.getByText('Б')).toHaveAttribute('aria-hidden'); // initials without a photo
  });
});

describe('Tag and Breadcrumbs', () => {
  it('tag links to its page', () => {
    renderWithIntl(<Tag tag={{ slug: 'songuul', nameMn: 'Сонгууль' }} />);
    expect(screen.getByRole('link', { name: 'Сонгууль' })).toHaveAttribute('href', '/tag/songuul');
  });

  it('breadcrumbs mark the current page and link the rest', () => {
    renderWithIntl(<Breadcrumbs items={[{ label: 'Нүүр', href: '/' }, { label: 'Хүмүүс', href: '/people' }, { label: 'Г.Батбаяр' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Таны байршил' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/', '/people']);
    expect(within(nav).getByText('Г.Батбаяр')).toHaveAttribute('aria-current', 'page');
  });
});

describe('Pagination', () => {
  const hrefFor = (n: number) => `/section/uls-tor?page=${n}`;

  it('links prev/next and numbered pages, marking the current one', () => {
    renderWithIntl(<Pagination page={5} totalPages={12} hrefFor={hrefFor} />);
    expect(screen.getByRole('link', { name: /Өмнөх/ })).toHaveAttribute('href', '/section/uls-tor?page=4');
    expect(screen.getByRole('link', { name: /Дараах/ })).toHaveAttribute('href', '/section/uls-tor?page=6');
    expect(screen.getByRole('link', { name: '5-р хуудас' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('5 / 12')).toBeInTheDocument();
  });

  it('disables the edge that does not exist and hides itself for one page', () => {
    const { unmount } = renderWithIntl(<Pagination page={1} totalPages={3} hrefFor={hrefFor} />);
    expect(screen.queryByRole('link', { name: /Өмнөх/ })).toBeNull();
    expect(screen.getByText('Өмнөх').closest('[aria-disabled]')).toBeInTheDocument();
    unmount();

    renderWithIntl(<Pagination page={1} totalPages={1} hrefFor={hrefFor} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('SourceLink', () => {
  it('inline: shows the host and opens safely in a new tab', () => {
    renderWithIntl(<SourceLink href="https://www.parliament.mn/n/123" />);
    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('Эх сурвалж · parliament.mn');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName(/шинэ цонхонд нээгдэнэ/);
  });

  it('icon: names the host for screen readers', () => {
    renderWithIntl(<SourceLink href="https://legalinfo.mn/law/1" variant="icon" />);
    expect(screen.getByRole('link', { name: 'Эх сурвалж: legalinfo.mn' })).toBeInTheDocument();
  });

  it('sourceHost tolerates bad URLs', () => {
    expect(sourceHost('not a url')).toBeNull();
    expect(sourceHost('https://www.montsame.mn/a')).toBe('montsame.mn');
  });
});

describe('CorrectionNotice', () => {
  it('lists corrections newest first with date, change and reason', () => {
    renderWithIntl(
      <CorrectionNotice
        corrections={[
          { date: '2026-10-02', description: 'Огноог зассан.', reason: 'Буруу оруулсан' },
          { date: '2026-10-05', description: 'Тоог зассан.', reason: 'Эх сурвалж шинэчлэгдсэн' },
        ]}
      />,
    );
    const note = screen.getByRole('note', { name: 'Залруулга (2)' });
    const items = within(note).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Тоог зассан.');
    expect(items[0]).toHaveTextContent('Шалтгаан: Эх сурвалж шинэчлэгдсэн');
    expect(within(items[1]!).getByText(/2026/)).toHaveAttribute('dateTime', '2026-10-02');
    expect(within(note).getByRole('link', { name: 'Бүх залруулгыг харах' })).toHaveAttribute('href', '/corrections');
  });

  it('renders nothing without corrections', () => {
    const { container } = renderWithIntl(<CorrectionNotice corrections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('RelatedArticles', () => {
  it('a labelled section of compact cards with level-3 headlines', () => {
    renderWithIntl(<RelatedArticles articles={[articleSummary({ id: 41, slug: 'a' }), articleSummary({ id: 40, slug: 'b', title: 'Хоёр дахь мэдээ' })]} />);

    const section = screen.getByRole('region', { name: 'Холбоотой мэдээ' });
    expect(within(section).getAllByRole('article')).toHaveLength(2);
    expect(within(section).getAllByRole('heading', { level: 3 })).toHaveLength(2);
    expect(within(section).getByRole('link', { name: 'Хоёр дахь мэдээ' })).toHaveAttribute('href', '/news/40-b');
  });

  it('renders nothing when there are no related articles', () => {
    const { container } = renderWithIntl(<RelatedArticles articles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('skeleton keeps the heading and is marked busy, with no links', () => {
    renderWithIntl(<RelatedArticlesSkeleton />);
    const section = screen.getByRole('region', { name: 'Холбоотой мэдээ' });
    expect(section).toHaveAttribute('aria-busy', 'true');
    expect(within(section).queryAllByRole('link')).toHaveLength(0);
  });
});

describe('Section page', () => {
  const category = { slug: 'uls-tor', nameMn: 'Улс төр' };
  const page = (count: number, firstId = 100) => Array.from({ length: count }, (_, i) => articleSummary({ id: firstId - i, slug: `a${firstId - i}`, title: `Мэдээ ${firstId - i}` }));

  it('page 1: lead card first, every headline a level-2 heading, pagination to /section/{slug}/2', () => {
    renderWithIntl(<SectionArticles category={category} articles={page(20)} page={1} totalPages={3} />);

    expect(screen.getAllByRole('article')).toHaveLength(20);
    expect(screen.getAllByRole('article')[0]).toHaveAttribute('data-size', 'lead');
    expect(screen.getAllByRole('article')[0]).toContainElement(screen.getByRole('link', { name: 'Мэдээ 100' }));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(20);
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    const nav = screen.getByRole('navigation', { name: 'Хуудаслалт' });
    expect(within(nav).getByRole('link', { name: 'Дараах' })).toHaveAttribute('href', '/section/uls-tor/2');
  });

  it('page 2: no lead, the first card loads its image first, page 1 has no number in its URL', () => {
    renderWithIntl(<SectionArticles category={category} articles={page(20, 80)} page={2} totalPages={3} />);

    expect(screen.getAllByRole('article')[0]).not.toHaveAttribute('data-size', 'lead');
    expect(document.querySelectorAll('[data-size="lead"]')).toHaveLength(0);
    expect(document.querySelectorAll('img[fetchpriority="high"]')).toHaveLength(1);
    expect(within(screen.getByRole('navigation', { name: 'Хуудаслалт' })).getByRole('link', { name: 'Өмнөх' })).toHaveAttribute('href', '/section/uls-tor');
  });

  it('an empty section shows a calm message with a way home, and no pagination', () => {
    renderWithIntl(<SectionArticles category={category} articles={[]} page={1} totalPages={0} />);
    expect(screen.getByText('Энэ ангилалд мэдээ хараахан нийтлэгдээгүй байна.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Нүүр хуудас руу' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('header: page number as the last crumb from page 2 on', () => {
    renderWithIntl(<SectionHeader category={category} page={2} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Улс төр' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Улс төр' })).toHaveAttribute('href', '/section/uls-tor');
    expect(screen.getByText('2-р хуудас')).toHaveAttribute('aria-current', 'page');
  });

  it('skeleton is marked busy and has no links', () => {
    const { container } = renderWithIntl(<SectionArticlesSkeleton />);
    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
