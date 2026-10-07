import type { PublicParliamentWeek } from '@news/shared/schemas';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { articleSummary } from '@/test/fixtures';
import { renderWithIntl } from '@/test/render';
import { CategorySection } from './category-section';
import { LatestFeed } from './latest-feed';
import { ParliamentWeek } from './parliament-week';
import { TopStories } from './top-stories';

const week: PublicParliamentWeek = {
  from: '2026-10-01',
  to: '2026-10-07',
  stages: [{ bill: { slug: 'tax', titleMn: 'Татварын хуулийн төсөл' }, stage: 'final_reading', date: '2026-10-06', noteMn: null, sourceUrl: 'https://parliament.mn/s' }],
  votes: [
    { bill: { slug: 'budget', titleMn: 'Төсвийн тухай хууль' }, date: '2026-10-07', motion: 'final_vote', tally: { yes: 51, no: 20, abstain: 1, absent: 4 }, sourceUrl: 'https://parliament.mn/v' },
    { bill: { slug: 'budget', titleMn: 'Төсвийн тухай хууль' }, date: '2026-10-05', motion: 'amendment_3', tally: { yes: 10, no: 0, abstain: 0, absent: 0 }, sourceUrl: 'https://parliament.mn/v2' },
  ],
};

describe('homepage sections', () => {
  it('top stories: the hero is the lead card, featured are compact', () => {
    renderWithIntl(<TopStories hero={articleSummary()} featured={[articleSummary({ id: 2, slug: 'b', title: 'Онцлох мэдээ' })]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Их Хурал 2027 оны төсвийг баталлаа' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Онцлох мэдээ' })).toHaveAttribute('href', '/news/2-b');
    expect(document.querySelector('img[fetchpriority="high"]')).toBeInTheDocument();
  });

  it('latest feed shows an empty state when there is nothing new', () => {
    renderWithIntl(<LatestFeed articles={[]} />);
    expect(screen.getByText('Шинэ мэдээ алга.')).toBeInTheDocument();
  });

  it('a category with no articles renders nothing', () => {
    const { container } = renderWithIntl(<CategorySection section={{ category: { slug: 'uls-tor', nameMn: 'Улс төр', nameEn: null }, articles: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('parliament week writes out every tally and links each item to its source', () => {
    renderWithIntl(<ParliamentWeek week={week} />);
    const block = screen.getByRole('region', { name: 'Парламент энэ долоо хоногт' });
    const [finalVote, amendment] = within(block).getAllByRole('listitem');
    expect(finalVote).toHaveTextContent('Эцсийн санал хураалт');
    expect(finalVote).toHaveTextContent('Зөвшөөрсөн 51');
    expect(finalVote).toHaveTextContent('Татгалзсан 20');
    expect(amendment).toHaveTextContent('amendment_3'); // unknown motions are shown as entered
    expect(within(block).getByText('Татварын хуулийн төсөл').closest('li')).toHaveTextContent('Эцсийн хэлэлцүүлэг');
    expect(within(block).getAllByRole('link', { name: /Эх сурвалж: parliament\.mn/ })).toHaveLength(3);
  });

  it('parliament week has a calm empty state', () => {
    renderWithIntl(<ParliamentWeek week={{ ...week, stages: [], votes: [] }} />);
    expect(screen.getByText('Энэ долоо хоногт бүртгэгдсэн үйл явдал алга.')).toBeInTheDocument();
  });
});
