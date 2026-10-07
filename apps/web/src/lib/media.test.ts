import { describe, expect, it } from 'vitest';
import { cover } from '@/test/fixtures';
import { imageSources } from './media';

describe('imageSources', () => {
  it('builds src and a width-described srcset from the variants', () => {
    expect(imageSources(cover)).toEqual({
      src: 'https://media.example/a-1024.webp',
      srcSet: 'https://media.example/a-320.webp 320w, https://media.example/a-1024.webp 1024w',
    });
  });

  it('returns null when nothing has a public URL yet', () => {
    expect(imageSources({ ...cover, url: null, variants: [{ width: 320, height: 180, url: null }] })).toBeNull();
  });
});
