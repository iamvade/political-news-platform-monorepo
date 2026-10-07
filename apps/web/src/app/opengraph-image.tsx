import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import messages from '../../messages/mn.json';

// Default share card for Facebook / X when a page has no image of its own (articles without a cover,
// the homepage, profiles without a photo). Colours mirror the light theme tokens in globals.css.

export const alt = messages.site.name;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const font = await readFile(join(process.cwd(), 'src/assets/fonts/source-serif-4-bold-mn.ttf'));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#fafaf8', fontFamily: 'Source Serif 4' }}>
        <div style={{ height: 24, background: '#1f3a5f' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 96px', gap: 28 }}>
          <div style={{ fontSize: 104, color: '#18181b', lineHeight: 1.05 }}>{messages.site.name}</div>
          <div style={{ fontSize: 40, color: '#44403c', lineHeight: 1.3, maxWidth: 960 }}>{messages.site.tagline}</div>
        </div>
        <div style={{ height: 8, background: '#b91c1c', width: 240, marginLeft: 96, marginBottom: 72 }} />
      </div>
    ),
    { ...size, fonts: [{ name: 'Source Serif 4', data: font, weight: 700, style: 'normal' }] },
  );
}
