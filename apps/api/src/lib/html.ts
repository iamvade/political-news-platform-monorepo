import { EMBED_SRC_PREFIXES, renderHtml, type ContentDoc } from '@news/shared/content';
import sanitize from 'sanitize-html';


/** Allowlist for article HTML. Mirrors what renderHtml can emit; anything else is discarded. */
const ARTICLE_HTML_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'strong', 'em', 'u', 's', 'code', 'a', 'img',
    'figure', 'figcaption', 'span', 'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    ol: ['start'],
    iframe: [
      'src',
      'title',
      'allowfullscreen',
      { name: 'loading', values: ['lazy'] },
      { name: 'referrerpolicy', values: ['strict-origin-when-cross-origin'] },
      { name: 'allow', values: ['encrypted-media; picture-in-picture'] },
    ],
  },
  allowedClasses: {
    figure: ['image', 'embed', 'embed-youtube', 'embed-facebook', 'pull-quote'],
    span: ['credit'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowedIframeHostnames: ['www.youtube-nocookie.com', 'www.facebook.com'],
  allowIframeRelativeUrls: false,
  // Drop disallowed tags *and* their content for script-like elements; unwrap the rest.
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'object', 'embed'],
  exclusiveFilter: (frame) => {
    // An iframe survives only with an embed URL we generate ourselves (a rejected src has already been removed).
    if (frame.tag === 'iframe') {
      const src = frame.attribs.src;
      return !src || !EMBED_SRC_PREFIXES.some((prefix) => src.startsWith(prefix));
    }
    // <span> exists only for image credits; any other span is unwrapped.
    if (frame.tag === 'span' && !frame.attribs.class?.split(/\s+/).includes('credit')) return 'excludeTag';
    return false;
  },
};

/** Second layer of defence: run any HTML through the article allowlist. */
export function sanitizeArticleHtml(html: string): string {
  return sanitize(html, ARTICLE_HTML_OPTIONS);
}

/** Tiptap JSON (already validated by contentDocSchema) → sanitized HTML for storage in articles.body_html. */
export function toSafeHtml(doc: ContentDoc): string {
  return sanitizeArticleHtml(renderHtml(doc));
}
