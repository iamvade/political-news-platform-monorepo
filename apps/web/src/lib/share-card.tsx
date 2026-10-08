import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

// Share cards for Facebook / X (1200×630 PNG via next/og): the site default (app/opengraph-image.tsx) and the
// per-article card for articles without a cover (app/news/[idSlug]/share-card). `ImageResponse` takes inline
// styles only, so the colours below mirror the light theme tokens in globals.css.

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

/** Longest headline on a card; longer ones are cut at a word so the text never overflows. */
const MAX_TITLE = 120;

/** Font size steps down with length so even a 120-character headline fits (about five lines at 52px). */
function titleStyle(title: string): { fontSize: number; lineHeight: number } {
  if (title.length <= 20) return { fontSize: 104, lineHeight: 1.05 };
  if (title.length <= 60) return { fontSize: 72, lineHeight: 1.15 };
  if (title.length <= 90) return { fontSize: 60, lineHeight: 1.15 };
  return { fontSize: 52, lineHeight: 1.2 };
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).trimEnd()}…`;
}

export interface ShareCardContent {
  /** Small red label above the title (the article's category). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Next to the red rule at the bottom (the site name on article cards). */
  footer?: string;
}

/**
 * The card image. The font is a committed TTF subset of Source Serif 4 Bold (src/assets/fonts/): it covers
 * Latin and the Mongolian Cyrillic letters (Ө ө Ү ү); other scripts would render as blanks.
 */
export async function renderShareCard(content: ShareCardContent, headers?: Record<string, string>): Promise<ImageResponse> {
  const font = await readFile(join(process.cwd(), 'src/assets/fonts/source-serif-4-bold-mn.ttf'));
  const title = shorten(content.title, MAX_TITLE);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fafaf8', fontFamily: 'Source Serif 4' }}>
        <div style={{ height: 24, background: '#1f3a5f' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 96px', gap: 28 }}>
          {content.eyebrow && <div style={{ fontSize: 32, color: '#b91c1c', lineHeight: 1.3 }}>{content.eyebrow}</div>}
          <div style={{ ...titleStyle(title), color: '#18181b' }}>{title}</div>
          {content.subtitle && <div style={{ fontSize: 40, color: '#44403c', lineHeight: 1.3, maxWidth: 960 }}>{content.subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginLeft: 96, marginBottom: 72 }}>
          <div style={{ height: 8, width: 240, background: '#b91c1c' }} />
          {content.footer && <div style={{ fontSize: 28, color: '#44403c' }}>{content.footer}</div>}
        </div>
      </div>
    ),
    { ...SHARE_CARD_SIZE, headers, fonts: [{ name: 'Source Serif 4', data: font, weight: 700, style: 'normal' }] },
  );
}
