export const EMBED_PROVIDERS = ['youtube', 'facebook'] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export interface ParsedEmbed {
  provider: EmbedProvider;
  /** Canonical public URL (stored in the document). */
  url: string;
  /** The only iframe URL ever rendered for this embed (allowlisted host). */
  embedSrc: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(url: URL, host: string): string | null {
  if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] ?? null;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v');
    const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
    return match?.[1] ?? null;
  }
  return null;
}

/** Facebook URL kinds we embed: posts and permalinks (post plugin), videos and reels (video plugin). */
function facebookEmbed(url: URL): ParsedEmbed | null {
  const path = url.pathname.replace(/\/+$/, '');
  const canonical = new URL(`https://www.facebook.com${path}`);
  let plugin: 'post' | 'video';

  if (/^\/[^/]+\/posts\/[^/]+$/.test(path)) plugin = 'post';
  else if (path === '/permalink.php' && url.searchParams.get('story_fbid') && url.searchParams.get('id')) {
    plugin = 'post';
    canonical.searchParams.set('story_fbid', url.searchParams.get('story_fbid')!);
    canonical.searchParams.set('id', url.searchParams.get('id')!);
  } else if (/^\/[^/]+\/videos\/[^/]+$/.test(path) || /^\/reel\/\d+$/.test(path)) plugin = 'video';
  else return null;

  const href = canonical.toString();
  const params = plugin === 'post' ? '&show_text=true&width=500' : '&show_text=false&width=560';
  return {
    provider: 'facebook',
    url: href,
    embedSrc: `https://www.facebook.com/plugins/${plugin}.php?href=${encodeURIComponent(href)}${params}`,
  };
}

/**
 * Recognises a pasted YouTube or Facebook URL. Returns null for anything else, so only these two providers
 * (and only their official embed endpoints) ever reach an iframe.
 */
export function parseEmbedUrl(input: string): ParsedEmbed | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');

  const id = youtubeId(url, host);
  if (id !== null) {
    if (!YOUTUBE_ID.test(id)) return null;
    return {
      provider: 'youtube',
      url: `https://www.youtube.com/watch?v=${id}`,
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }
  if (host === 'facebook.com') return facebookEmbed(url);
  return null;
}
