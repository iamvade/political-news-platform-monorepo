import { parseEmbedUrl } from './embed';
import type { BlockNode, ContentDoc, ContentMark, InlineNode, ListItemNode } from './schema';

/**
 * Renders a validated document to HTML. Only known node types produce markup and every text/attribute value
 * is escaped, so output is safe by construction. The API still runs it through sanitize-html as a second layer.
 */
export function renderHtml(doc: ContentDoc): string {
  return (doc.content ?? []).map(renderBlock).join('');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBlock(node: BlockNode): string {
  switch (node.type) {
    case 'paragraph':
      return `<p>${renderInline(node.content)}</p>`;
    case 'heading':
      return `<h${node.attrs.level}>${renderInline(node.content)}</h${node.attrs.level}>`;
    case 'bulletList':
      return `<ul>${node.content.map(renderListItem).join('')}</ul>`;
    case 'orderedList': {
      const start = node.attrs?.start;
      const startAttr = start !== undefined && start !== 1 ? ` start="${start}"` : '';
      return `<ol${startAttr}>${node.content.map(renderListItem).join('')}</ol>`;
    }
    case 'blockquote':
      return `<blockquote>${node.content.map(renderBlock).join('')}</blockquote>`;
    case 'horizontalRule':
      return '<hr>';
    case 'image': {
      const { src, alt, title, caption, credit } = node.attrs;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      const img = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? '')}"${titleAttr}>`;
      if (!caption && !credit) return img;
      const captionHtml = caption ? escapeHtml(caption) : '';
      const creditHtml = credit ? `<span class="credit">${escapeHtml(credit)}</span>` : '';
      const separator = caption && credit ? ' ' : '';
      return `<figure class="image">${img}<figcaption>${captionHtml}${separator}${creditHtml}</figcaption></figure>`;
    }
    case 'embed': {
      // The iframe URL is always derived from the parsed URL, never taken from stored attributes.
      const parsed = parseEmbedUrl(node.attrs.url);
      if (!parsed) return '';
      return (
        `<figure class="embed embed-${parsed.provider}">` +
        `<iframe src="${escapeHtml(parsed.embedSrc)}" title="${parsed.provider === 'youtube' ? 'YouTube' : 'Facebook'}" ` +
        'loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture">' +
        '</iframe></figure>'
      );
    }
    case 'pullQuote': {
      const attribution = node.attrs?.attribution;
      const caption = attribution ? `<figcaption>${escapeHtml(attribution)}</figcaption>` : '';
      return `<figure class="pull-quote"><blockquote><p>${renderInline(node.content)}</p></blockquote>${caption}</figure>`;
    }
  }
}

function renderListItem(item: ListItemNode): string {
  return `<li>${item.content.map(renderBlock).join('')}</li>`;
}

function renderInline(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === 'hardBreak' ? '<br>' : applyMarks(escapeHtml(node.text), node.marks)))
    .join('');
}

function applyMarks(html: string, marks: ContentMark[] | undefined): string {
  let result = html;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        result = `<strong>${result}</strong>`;
        break;
      case 'italic':
        result = `<em>${result}</em>`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      case 'strike':
        result = `<s>${result}</s>`;
        break;
      case 'code':
        result = `<code>${result}</code>`;
        break;
      case 'link': {
        const external = mark.attrs.target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
        result = `<a href="${escapeHtml(mark.attrs.href)}"${external}>${result}</a>`;
        break;
      }
    }
  }
  return result;
}
