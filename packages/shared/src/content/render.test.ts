import { describe, expect, it } from 'vitest';
import { renderHtml } from './render';
import { contentDocSchema, hasText, MAX_CONTENT_DEPTH, type ContentDoc } from './schema';

const p = (text: string, marks?: unknown[]) => ({ type: 'paragraph', content: [{ type: 'text', text, marks }] });
const doc = (...content: unknown[]) => ({ type: 'doc', content });

function render(input: unknown): string {
  return renderHtml(contentDocSchema.parse(input) as ContentDoc);
}

describe('renderHtml', () => {
  it('renders every allowed node and mark', () => {
    const html = render(
      doc(
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Гарчиг' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'b', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'i', marks: [{ type: 'italic' }] },
            { type: 'text', text: 'u', marks: [{ type: 'underline' }] },
            { type: 'text', text: 's', marks: [{ type: 'strike' }] },
            { type: 'text', text: 'c', marks: [{ type: 'code' }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.mn/a?b=1&c=2', target: '_blank' } }] },
          ],
        },
        { type: 'bulletList', content: [{ type: 'listItem', content: [p('нэг')] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p('гурав')] }] },
        { type: 'blockquote', content: [p('ишлэл')] },
        { type: 'horizontalRule' },
        { type: 'image', attrs: { src: 'https://media.example/a.jpg', alt: 'Зураг', title: null } },
      ),
    );

    expect(html).toBe(
      '<h2>Гарчиг</h2>' +
        '<p><strong>b</strong><em>i</em><u>u</u><s>s</s><code>c</code><br>' +
        '<a href="https://example.mn/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">link</a></p>' +
        '<ul><li><p>нэг</p></li></ul>' +
        '<ol start="3"><li><p>гурав</p></li></ol>' +
        '<blockquote><p>ишлэл</p></blockquote>' +
        '<hr>' +
        '<img src="https://media.example/a.jpg" alt="Зураг">',
    );
  });

  it('escapes text, so injected markup is inert', () => {
    const html = render(doc(p('<script>alert(1)</script><img src=x onerror=alert(1)>"\'')));

    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;&quot;&#39;</p>');
  });

  it('preserves Mongolian letters', () => {
    expect(render(doc(p('Өлзий Үүрцайх')))).toBe('<p>Өлзий Үүрцайх</p>');
  });

  it('drops unknown attributes such as event handlers', () => {
    const html = render(doc({ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [{ type: 'text', text: 'x' }] }));

    expect(html).toBe('<p>x</p>');
  });
});

describe('contentDocSchema', () => {
  it.each([
    ['javascript: link', doc(p('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]))],
    ['data: link', doc(p('x', [{ type: 'link', attrs: { href: 'data:text/html,<script>alert(1)</script>' } }]))],
    ['relative link', doc(p('x', [{ type: 'link', attrs: { href: '/admin' } }]))],
    ['http image', doc({ type: 'image', attrs: { src: 'http://media.example/a.jpg' } })],
    ['unknown node', doc({ type: 'iframe', attrs: { src: 'https://evil.example' } })],
    ['unknown mark', doc(p('x', [{ type: 'highlight' }]))],
    ['h1 heading', doc({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'x' }] })],
    ['raw html node', doc({ type: 'html', content: '<script>alert(1)</script>' })],
    ['not a doc', { type: 'paragraph' }],
  ])('rejects %s', (_label, input) => {
    expect(contentDocSchema.safeParse(input).success).toBe(false);
  });

  it('rejects hostile nesting without overflowing the stack', () => {
    let node: unknown = p('deep');
    for (let i = 0; i < 10_000; i++) node = { type: 'blockquote', content: [node] };

    const result = contentDocSchema.safeParse(doc(node));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain(String(MAX_CONTENT_DEPTH));
  });

  it('accepts an empty Tiptap document', () => {
    expect(contentDocSchema.safeParse({ type: 'doc', content: [{ type: 'paragraph' }] }).success).toBe(true);
  });
});

describe('hasText', () => {
  it('detects real text only', () => {
    expect(hasText(contentDocSchema.parse(doc({ type: 'paragraph' })) as ContentDoc)).toBe(false);
    expect(hasText(contentDocSchema.parse(doc(p('   '))) as ContentDoc)).toBe(false);
    expect(hasText(contentDocSchema.parse(doc({ type: 'blockquote', content: [p('мэдээ')] })) as ContentDoc)).toBe(true);
  });
});

describe('editor nodes', () => {
  it('renders a library image with caption and credit as a figure', () => {
    const html = render(
      doc({ type: 'image', attrs: { src: 'https://media.example/w1024.webp', alt: 'Ордон', mediaId: 4, caption: 'Төрийн ордон', credit: 'Б.Сараа' } }),
    );

    expect(html).toBe(
      '<figure class="image"><img src="https://media.example/w1024.webp" alt="Ордон"><figcaption>Төрийн ордон <span class="credit">Б.Сараа</span></figcaption></figure>',
    );
  });

  it('renders embeds from the parsed URL only', () => {
    const html = render(doc({ type: 'embed', attrs: { provider: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ' } }));

    expect(html).toContain('<figure class="embed embed-youtube"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(html).toContain('loading="lazy"');
  });

  it('rejects embeds whose provider does not match the URL', () => {
    expect(
      contentDocSchema.safeParse(doc({ type: 'embed', attrs: { provider: 'facebook', url: 'https://youtu.be/dQw4w9WgXcQ' } })).success,
    ).toBe(false);
    expect(contentDocSchema.safeParse(doc({ type: 'embed', attrs: { provider: 'youtube', url: 'https://evil.example/x' } })).success).toBe(false);
  });

  it('renders a pull quote with escaped attribution', () => {
    const html = render(
      doc({ type: 'pullQuote', attrs: { attribution: 'Г.Батбаяр <b>' }, content: [{ type: 'text', text: 'Хууль батлагдлаа' }] }),
    );

    expect(html).toBe('<figure class="pull-quote"><blockquote><p>Хууль батлагдлаа</p></blockquote><figcaption>Г.Батбаяр &lt;b&gt;</figcaption></figure>');
  });

  it('counts pull-quote text as content', () => {
    const parsed = contentDocSchema.parse(doc({ type: 'pullQuote', content: [{ type: 'text', text: 'Ишлэл' }] })) as ContentDoc;

    expect(hasText(parsed)).toBe(true);
  });
});

