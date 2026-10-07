'use client';

import { useEffect } from 'react';

/**
 * Turns a tapped embed placeholder (see lib/article-html.ts) into the provider's iframe. The URL is checked
 * against the allowlist again here, so a tampered page cannot load anything else.
 */
export function EmbedActivator({ allowedPrefixes }: { allowedPrefixes: readonly string[] }) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest?.('button[data-embed-src]');
      if (!(button instanceof HTMLButtonElement)) return;
      const src = button.dataset.embedSrc ?? '';
      if (!allowedPrefixes.some((prefix) => src.startsWith(prefix))) return;
      const iframe = document.createElement('iframe');
      // The reader asked for it, so start playing (YouTube) right away.
      iframe.src = src.includes('youtube-nocookie.com') ? `${src}${src.includes('?') ? '&' : '?'}autoplay=1` : src;
      iframe.title = button.dataset.embedTitle ?? '';
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      button.replaceWith(iframe);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [allowedPrefixes]);
  return null;
}
