// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

/** Custom properties declared in the first block whose selector matches `selector`. */
function tokens(selector: RegExp): Record<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`Block not found: ${selector}`);
  const body = css.slice(match.index + match[0].length, css.indexOf('}', match.index));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1]!, m[2]!]));
}

const light = tokens(/:root,\s*\[data-theme='light'\]\s*\{/);
const dark = tokens(/\n\[data-theme='dark'\]\s*\{/);
const systemDark = tokens(/:root:not\(\[data-theme='light'\]\)\s*\{/);

// Text colour → backgrounds it is used on. WCAG AA for normal text: 4.5:1.
const PAIRS: [string, string[]][] = [
  ['ink', ['canvas', 'surface', 'surface-muted']],
  ['ink-muted', ['canvas', 'surface', 'surface-muted']],
  ['ink-subtle', ['canvas', 'surface', 'surface-muted']],
  ['link', ['canvas', 'surface']],
  ['accent-ink', ['accent']],
  ['breaking-ink', ['breaking']],
  ['notice-ink', ['notice-bg']],
];

describe('colour tokens', () => {
  it.each([
    ['light', light],
    ['dark', dark],
  ])('%s theme meets WCAG AA for every text pair', (_name, theme) => {
    const failures = PAIRS.flatMap(([fg, backgrounds]) =>
      backgrounds.flatMap((bg) => {
        const ratio = contrastRatio(theme[fg]!, theme[bg]!);
        return ratio >= 4.5 ? [] : [`${fg} on ${bg}: ${ratio.toFixed(2)}`];
      }),
    );
    expect(failures).toEqual([]);
  });

  it('focus ring is visible on the page background (3:1, non-text)', () => {
    expect(contrastRatio(light.focus!, light.canvas!)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(dark.focus!, dark.canvas!)).toBeGreaterThanOrEqual(3);
  });

  it('defines the same tokens in both themes, and the system-dark block matches the explicit dark block', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(systemDark).toEqual(dark);
  });
});
