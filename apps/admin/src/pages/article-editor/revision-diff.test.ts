import { describe, expect, it } from 'vitest';
import { valuesFromArticle } from './editor-store';
import { docPlainText, hasChanges, revisionDiff } from './revision-diff';

const doc = (...paragraphs: string[]) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : undefined })),
});

const current = {
  ...valuesFromArticle(null),
  title: 'Их Хурал хуралдлаа',
  lede: '',
  bodyJson: doc('Нэгдүгээр догол.', 'Хоёрдугаар догол шинэ.'),
  categoryId: 2,
  personIds: [1, 3],
};

describe('docPlainText', () => {
  it('joins block text by line and skips empty blocks', () => {
    expect(docPlainText(doc('А', '', 'Б'))).toBe('А\nБ');
    expect(
      docPlainText({
        type: 'doc',
        content: [
          { type: 'embed', attrs: { provider: 'youtube', url: 'https://youtu.be/x' } },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'жагсаалт' }] }] }] },
        ],
      }),
    ).toBe('[https://youtu.be/x]\nжагсаалт');
  });
});

describe('revisionDiff', () => {
  it('reports word changes and changed fields from the revision to the current values', () => {
    const diff = revisionDiff(
      { title: 'Их Хурал хуралдана', lede: null, bodyJson: doc('Нэгдүгээр догол.', 'Хоёрдугаар догол.'), categoryId: null, personIds: [1, 2] },
      current,
    );

    expect(diff.title?.filter((c) => c.added).map((c) => c.value)).toEqual(['хуралдлаа']);
    expect(diff.title?.filter((c) => c.removed).map((c) => c.value)).toEqual(['хуралдана']);
    expect(diff.lede).toBeNull();
    expect(diff.body?.filter((c) => c.added).map((c) => c.value.trim())).toEqual(['шинэ']);
    expect(diff.scalars).toEqual([{ field: 'categoryId', before: null, after: 2 }]);
    expect(diff.links).toEqual([{ field: 'personIds', added: [3], removed: [2] }]);
  });

  it('skips link fields missing from old snapshots and detects no changes', () => {
    const snapshot = { title: current.title, lede: '', bodyJson: current.bodyJson, categoryId: 2, coverMediaId: null, isBreaking: false };

    const diff = revisionDiff(snapshot, current);

    expect(diff.links).toEqual([]);
    expect(hasChanges(diff)).toBe(false);
  });
});
