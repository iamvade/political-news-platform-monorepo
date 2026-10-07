import { EMBED_SRC_PREFIXES, renderHtml } from '@news/shared/content';
import { describe, expect, it } from 'vitest';
import { deferEmbeds } from './article-html';

const labels = { youtube: 'YouTube видео тоглуулах', facebook: 'Facebook нийтлэл харах', hint: 'Дарсны дараа ачаална.' };

describe('deferEmbeds', () => {
  it('turns API embed iframes into click-to-load buttons and keeps everything else', () => {
    const html = renderHtml({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Өмнөх' }] },
        { type: 'embed', attrs: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' } },
        { type: 'embed', attrs: { provider: 'facebook', url: 'https://www.facebook.com/page/posts/123' } },
      ],
    });

    const out = deferEmbeds(html, labels, EMBED_SRC_PREFIXES);

    expect(out).not.toContain('<iframe');
    expect(out).toContain('<p>Өмнөх</p>');
    expect(out).toContain('data-embed-src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(out).toContain('data-embed-src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpage%2Fposts%2F123&amp;show_text=true&amp;width=500"');
    expect(out).toContain('<span class="embed-load-label">Facebook нийтлэл харах</span>');
  });

  it('drops an iframe outside the allowlist', () => {
    const html = '<figure class="embed embed-youtube"><iframe src="https://evil.example/x" title="YouTube"></iframe></figure><p>ok</p>';
    expect(deferEmbeds(html, labels, EMBED_SRC_PREFIXES)).toBe('<p>ok</p>');
  });
});
