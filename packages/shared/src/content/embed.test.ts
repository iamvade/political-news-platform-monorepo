import { describe, expect, it } from 'vitest';
import { parseEmbedUrl } from './embed';

describe('parseEmbedUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('YouTube %s', (input, id) => {
    expect(parseEmbedUrl(input)).toEqual({
      provider: 'youtube',
      url: `https://www.youtube.com/watch?v=${id}`,
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
    });
  });

  it('Facebook post and permalink use the post plugin with a cleaned URL', () => {
    expect(parseEmbedUrl('https://www.facebook.com/montsame/posts/pfbid02abc?ref=share&mibextid=x')).toEqual({
      provider: 'facebook',
      url: 'https://www.facebook.com/montsame/posts/pfbid02abc',
      embedSrc:
        'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fmontsame%2Fposts%2Fpfbid02abc&show_text=true&width=500',
    });
    expect(parseEmbedUrl('https://m.facebook.com/permalink.php?story_fbid=123&id=456&tracking=1')?.url).toBe(
      'https://www.facebook.com/permalink.php?story_fbid=123&id=456',
    );
  });

  it('Facebook videos and reels use the video plugin', () => {
    expect(parseEmbedUrl('https://www.facebook.com/montsame/videos/987654321/')?.embedSrc).toContain('/plugins/video.php?href=');
    expect(parseEmbedUrl('https://www.facebook.com/reel/123456789')?.embedSrc).toContain('/plugins/video.php?href=');
  });

  it.each([
    'not a url',
    'javascript:alert(1)',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>',
    'https://www.facebook.com/montsame',
    'https://www.facebook.com/plugins/post.php?href=x',
    'ftp://youtu.be/dQw4w9WgXcQ',
  ])('rejects %s', (input) => {
    expect(parseEmbedUrl(input)).toBeNull();
  });
});
