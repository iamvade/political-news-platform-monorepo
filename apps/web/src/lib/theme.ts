/** Reader's theme choice. "auto" (no stored value) follows the phone setting via prefers-color-scheme. */
export type ThemePreference = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
const CHANGE_EVENT = 'theme-change';

/**
 * Inline in <head>, runs before first paint: applies a saved light/dark choice to <html data-theme>.
 * Nothing is read on the server, so pages stay static/ISR-cacheable. Needs a CSP hash once a CSP exists.
 */
export const themeScript = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(preference: ThemePreference): void {
  try {
    if (preference === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Private mode: the choice still applies to this page view.
  }
  if (preference === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeTheme(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

export const NEXT_THEME: Record<ThemePreference, ThemePreference> = { auto: 'light', light: 'dark', dark: 'auto' };
