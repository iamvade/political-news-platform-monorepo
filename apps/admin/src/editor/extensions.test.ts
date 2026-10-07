import { contentDocSchema, renderHtml } from '@news/shared/content';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { articleExtensions } from './extensions';

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function makeEditor(content?: unknown) {
  editor = new Editor({ extensions: articleExtensions('…'), content: content as never });
  return editor;
}

describe('editor schema ↔ content allowlist', () => {
  it('produces JSON the API accepts for every toolbar node and mark', () => {
    const e = makeEditor();
    e.chain()
      .setContent('<h2>Гарчиг</h2><p><strong>Өө</strong> <em>Үү</em> <a href="https://example.mn">холбоос</a></p><ul><li><p>a</p></li></ul><ol><li><p>b</p></li></ol><blockquote><p>ишлэл</p></blockquote>')
      .run();
    e.chain()
      .focus('end')
      .insertContent([
        { type: 'image', attrs: { src: 'https://media.test/a.webp', alt: 'Зураг', mediaId: 4, caption: 'Тайлбар', credit: 'Фото' } },
        { type: 'embed', attrs: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
        { type: 'pullQuote', attrs: { attribution: 'Б.Бат' }, content: [{ type: 'text', text: 'Тодотгол' }] },
      ])
      .run();

    const parsed = contentDocSchema.safeParse(e.getJSON());

    expect(parsed.error?.issues).toBeUndefined();
    const html = renderHtml(parsed.data!);
    expect(html).toContain('<h2>Гарчиг</h2>');
    expect(html).toContain('<a href="https://example.mn" target="_blank" rel="noopener noreferrer">холбоос</a>');
    expect(html).toContain('<figcaption>Тайлбар <span class="credit">Фото</span></figcaption>');
    expect(html).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('<figure class="pull-quote"><blockquote><p>Тодотгол</p></blockquote><figcaption>Б.Бат</figcaption></figure>');
  });

  it('loads stored documents unchanged (round trip)', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Өнөөдөр' }] },
        { type: 'image', attrs: { src: 'https://media.test/a.webp', alt: 'a', title: null, mediaId: 4, caption: null, credit: 'Фото' } },
        { type: 'embed', attrs: { provider: 'facebook', url: 'https://www.facebook.com/page/posts/123' } },
        { type: 'pullQuote', attrs: { attribution: null }, content: [{ type: 'text', text: 'Ишлэл' }] },
      ],
    };
    const e = makeEditor(doc);

    expect(renderHtml(contentDocSchema.parse(e.getJSON()))).toBe(renderHtml(contentDocSchema.parse(doc)));
  });

  it('drops pasted code blocks, h1 and non-https images instead of producing invalid JSON', () => {
    const e = makeEditor();
    e.commands.setContent('<h1>Том</h1><pre><code>x</code></pre><img src="http://insecure.example/a.jpg"><p><a href="javascript:alert(1)">x</a></p>');

    const parsed = contentDocSchema.safeParse(e.getJSON());

    expect(parsed.success).toBe(true);
    expect(JSON.stringify(e.getJSON())).not.toContain('insecure.example');
    expect(JSON.stringify(e.getJSON())).not.toContain('javascript:');
  });
});
