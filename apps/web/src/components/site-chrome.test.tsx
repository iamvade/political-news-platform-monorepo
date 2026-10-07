import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { setPathname } from '@/test/setup';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { ThemeToggle } from './theme-toggle';

describe('SiteHeader', () => {
  it('has the wordmark, search, theme toggle and the main nav with the current section marked', () => {
    setPathname('/people/abc');
    renderWithIntl(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Улс төрийн мэдээ' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Хайх' })).toHaveAttribute('href', '/search');
    const [desktop] = screen.getAllByRole('navigation', { name: 'Үндсэн цэс' });
    expect(within(desktop!).getByRole('link', { name: 'Хүмүүс' })).toHaveAttribute('aria-current', 'page');
    expect(within(desktop!).getByRole('link', { name: 'Мэдээ' })).not.toHaveAttribute('aria-current');
  });

  it('opens the phone menu without page JavaScript (native details)', async () => {
    renderWithIntl(<SiteHeader />);
    const details = document.querySelector('details')!;
    expect(details.open).toBe(false);

    await userEvent.click(screen.getByText((_, el) => el?.tagName === 'SUMMARY'));

    expect(details.open).toBe(true);
    expect(within(details).getAllByRole('link').map((a) => a.textContent)).toEqual(['Мэдээ', 'Хүмүүс', 'УИХ', 'Засгийн газар']);
  });
});

describe('ThemeToggle', () => {
  it('cycles auto → light → dark → auto and applies the choice', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName('Өнгөний горим: утасны тохиргоогоор. Дарвал: цайвар');

    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('light');
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(button).toHaveAccessibleName('Өнгөний горим: бараан. Дарвал: утасны тохиргоогоор');
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe('SiteFooter', () => {
  it('links the trust pages', () => {
    renderWithIntl(<SiteFooter />);
    for (const [name, href] of [
      ['Редакцийн бодлого', '/about/editorial-policy'],
      ['Арга зүй', '/about/methodology'],
      ['Өмчлөл, санхүүжилт', '/about/ownership'],
      ['Залруулга', '/corrections'],
      ['Хариу тайлбар өгөх', '/reply'],
    ]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
