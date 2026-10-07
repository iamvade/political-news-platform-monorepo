import { describe, expect, it } from 'vitest';
import { sanitizeArticleHtml, toSafeHtml } from './html';

describe('sanitizeArticleHtml (defence in depth, even if the renderer were bypassed)', () => {
  it.each([
    ['script tag and content', '<p>a</p><script>alert(1)</script>', '<p>a</p>'],
    ['iframe', '<p>a</p><iframe src="https://evil.example"></iframe>', '<p>a</p>'],
    ['event handler', '<img src="https://media.example/a.jpg" onerror="alert(1)">', '<img src="https://media.example/a.jpg" />'],
    ['style attribute', '<p style="position:fixed">a</p>', '<p>a</p>'],
    ['style tag', '<style>body{display:none}</style><p>a</p>', '<p>a</p>'],
    ['javascript: link', '<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
    ['data: link', '<a href="data:text/html,x">x</a>', '<a>x</a>'],
    ['http image', '<img src="http://media.example/a.jpg">', '<img />'],
    ['unknown tag is unwrapped', '<div><span>текст</span></div>', 'текст'],
    ['h1 is unwrapped', '<h1>Гарчиг</h1>', 'Гарчиг'],
    ['iframe from another host', '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>', ''],
    ['iframe on an allowed host but another path', '<iframe src="https://www.facebook.com/evil"></iframe>', ''],
    ['javascript: iframe', '<iframe src="javascript:alert(1)"></iframe>', ''],
    ['relative iframe', '<iframe src="/embed/x"></iframe>', ''],
    ['http iframe', '<iframe src="http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>', ''],
    [
      'iframe srcdoc and handlers',
      '<iframe srcdoc="<script>alert(1)</script>" onload="x()" src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>',
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>',
    ],
    ['unknown figure class', '<figure class="evil image">x</figure>', '<figure class="image">x</figure>'],
    ['span without the credit class is unwrapped', '<span class="evil">a</span>', 'a'],
  ])('%s', (_label, input, expected) => {
    expect(sanitizeArticleHtml(input)).toBe(expected);
  });

  it('keeps allowed markup intact', () => {
    const html = '<h2>Гарчиг</h2><p><strong>a</strong> <a href="https://example.mn" target="_blank" rel="noopener noreferrer">b</a></p><ol start="3"><li><p>c</p></li></ol>';

    expect(sanitizeArticleHtml(html)).toBe(html);
  });
});

describe('toSafeHtml', () => {
  it('keeps the markup of editor nodes (figures, allowlisted embeds, pull quotes)', () => {
    const html = toSafeHtml({
      type: 'doc',
      content: [
        { type: 'embed', attrs: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' } },
        { type: 'embed', attrs: { provider: 'facebook', url: 'https://www.facebook.com/page/posts/123' } },
        { type: 'image', attrs: { src: 'https://media.example/a.webp', alt: 'a', caption: 'Тайлбар', credit: 'Фото: Б' } },
        { type: 'pullQuote', attrs: { attribution: 'Х' }, content: [{ type: 'text', text: 'Ишлэл' }] },
      ],
    });

    expect(html).toBe(
      '<figure class="embed embed-youtube"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture"></iframe></figure>' +
        '<figure class="embed embed-facebook"><iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fpage%2Fposts%2F123&amp;show_text=true&amp;width=500" title="Facebook" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture"></iframe></figure>' +
        '<figure class="image"><img src="https://media.example/a.webp" alt="a" /><figcaption>Тайлбар <span class="credit">Фото: Б</span></figcaption></figure>' +
        '<figure class="pull-quote"><blockquote><p>Ишлэл</p></blockquote><figcaption>Х</figcaption></figure>',
    );
  });

  it('renders and sanitizes a document', () => {
    const html = toSafeHtml({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> Өнөөдөр' }] }],
    });

    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt; Өнөөдөр</p>');
  });
});
