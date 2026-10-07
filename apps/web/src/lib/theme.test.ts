import { describe, expect, it } from 'vitest';
import { applyTheme, readTheme, themeScript, THEME_STORAGE_KEY } from './theme';

describe('theme', () => {
  it('stores light/dark on <html data-theme> and clears it for auto', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readTheme()).toBe('dark');

    applyTheme('auto');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readTheme()).toBe('auto');
  });

  it('the inline script applies a saved choice and ignores anything else', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe('light');

    delete document.documentElement.dataset.theme;
    localStorage.setItem(THEME_STORAGE_KEY, '<script>');
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
