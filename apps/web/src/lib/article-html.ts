import { escapeHtml } from '@news/shared/content';

// Matches exactly what the API's renderer + sanitizer emit for an embed (apps/api/src/lib/html.ts).
const EMBED_FIGURE = /<figure class="embed embed-(youtube|facebook)"><iframe src="([^"]+)"[^>]*><\/iframe><\/figure>/g;

const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export interface EmbedLabels {
  youtube: string;
  facebook: string;
  /** Explains that the provider loads only after the tap. */
  hint: string;
}

/**
 * Click-to-load embeds (privacy + LCP, decided 2026-10-07): each allowlisted iframe in the sanitized body HTML
 * becomes a button carrying the iframe URL. `EmbedActivator` swaps it for the iframe when tapped. Iframes on
 * any other URL (should never happen after the API sanitizer) are removed.
 */
export function deferEmbeds(html: string, labels: EmbedLabels, allowedPrefixes: readonly string[]): string {
  return html.replace(EMBED_FIGURE, (_match, provider: 'youtube' | 'facebook', rawSrc: string) => {
    const src = decode(rawSrc);
    if (!allowedPrefixes.some((prefix) => src.startsWith(prefix))) return '';
    const label = escapeHtml(labels[provider]);
    return (
      `<figure class="embed embed-${provider}">` +
      `<button type="button" class="embed-load" data-embed-src="${escapeHtml(src)}" data-embed-title="${label}">` +
      `<span class="embed-load-label">${label}</span><span class="embed-load-hint">${escapeHtml(labels.hint)}</span>` +
      `</button></figure>`
    );
  });
}
