import { z } from 'zod';
import { EMBED_PROVIDERS, parseEmbedUrl, type EmbedProvider } from './embed';

/**
 * Allowlisted Tiptap/ProseMirror document shape. Anything not described here (unknown node or mark types,
 * non-http(s) links, non-https images) is rejected, so the editor and the server must agree on extensions.
 * Unknown *attributes* on known nodes are stripped.
 */

export type LinkMark = { type: 'link'; attrs: { href: string; target?: '_blank' | null } };
export type ContentMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | LinkMark;

export type TextNode = { type: 'text'; text: string; marks?: ContentMark[] };
export type HardBreakNode = { type: 'hardBreak' };
export type InlineNode = TextNode | HardBreakNode;

export type ParagraphNode = { type: 'paragraph'; content?: InlineNode[] };
export type HeadingNode = { type: 'heading'; attrs: { level: 2 | 3 | 4 }; content?: InlineNode[] };
export type ListItemNode = { type: 'listItem'; content: BlockNode[] };
export type BulletListNode = { type: 'bulletList'; content: ListItemNode[] };
export type OrderedListNode = { type: 'orderedList'; attrs?: { start?: number }; content: ListItemNode[] };
export type BlockquoteNode = { type: 'blockquote'; content: BlockNode[] };
export type HorizontalRuleNode = { type: 'horizontalRule' };
export type ImageNode = {
  type: 'image';
  attrs: {
    src: string;
    alt?: string | null;
    title?: string | null;
    /** Media library id (images inserted from the picker). */
    mediaId?: number | null;
    caption?: string | null;
    credit?: string | null;
  };
};
export type EmbedNode = { type: 'embed'; attrs: { provider: EmbedProvider; url: string } };
export type PullQuoteNode = { type: 'pullQuote'; attrs?: { attribution?: string | null }; content?: InlineNode[] };
export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | HorizontalRuleNode
  | ImageNode
  | EmbedNode
  | PullQuoteNode;

export type ContentDoc = { type: 'doc'; content?: BlockNode[] };

/** Nesting deeper than this is rejected before schema parsing (protects the recursive parser and renderer). */
export const MAX_CONTENT_DEPTH = 32;

function urlWithProtocol(protocols: string[]) {
  return z
    .string()
    .max(2048)
    .refine((value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, `Must be an absolute ${protocols.join(' / ')} URL`);
}

const markSchema: z.ZodType<ContentMark> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('code') }),
  z.object({
    type: z.literal('link'),
    attrs: z.object({
      href: urlWithProtocol(['http:', 'https:', 'mailto:']),
      target: z.literal('_blank').nullable().optional(),
    }),
  }),
]);

const textNodeSchema: z.ZodType<TextNode> = z.object({
  type: z.literal('text'),
  text: z.string().min(1).max(100_000),
  marks: z.array(markSchema).max(10).optional(),
});

const inlineNodeSchema: z.ZodType<InlineNode> = z.union([
  textNodeSchema,
  z.object({ type: z.literal('hardBreak') }),
]);

const inlineContent = z.array(inlineNodeSchema).optional();

const blockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('paragraph'), content: inlineContent }),
    z.object({
      type: z.literal('heading'),
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3), z.literal(4)]) }),
      content: inlineContent,
    }),
    z.object({ type: z.literal('bulletList'), content: z.array(listItemSchema).min(1) }),
    z.object({
      type: z.literal('orderedList'),
      attrs: z.object({ start: z.number().int().min(0).optional() }).optional(),
      content: z.array(listItemSchema).min(1),
    }),
    z.object({ type: z.literal('blockquote'), content: z.array(blockNodeSchema).min(1) }),
    z.object({ type: z.literal('horizontalRule') }),
    z.object({
      type: z.literal('image'),
      attrs: z.object({
        src: urlWithProtocol(['https:']),
        alt: z.string().max(500).nullable().optional(),
        title: z.string().max(500).nullable().optional(),
        mediaId: z.number().int().positive().nullable().optional(),
        caption: z.string().max(1000).nullable().optional(),
        credit: z.string().max(300).nullable().optional(),
      }),
    }),
    z.object({
      type: z.literal('embed'),
      attrs: z
        .object({ provider: z.enum(EMBED_PROVIDERS), url: z.string().max(2048) })
        .refine((attrs) => parseEmbedUrl(attrs.url)?.provider === attrs.provider, 'Unsupported or mismatched embed URL'),
    }),
    z.object({
      type: z.literal('pullQuote'),
      attrs: z.object({ attribution: z.string().max(300).nullable().optional() }).optional(),
      content: inlineContent,
    }),
  ]),
);

const listItemSchema: z.ZodType<ListItemNode> = z.lazy(() =>
  z.object({ type: z.literal('listItem'), content: z.array(blockNodeSchema).min(1) }),
);

const docNodeSchema: z.ZodType<ContentDoc> = z.object({
  type: z.literal('doc'),
  content: z.array(blockNodeSchema).max(5_000).optional(),
});

/** Iterative depth check, so hostile nesting cannot overflow the stack before validation. */
function depthOf(value: unknown): number {
  let max = 0;
  const stack: [unknown, number][] = [[value, 1]];
  while (stack.length > 0) {
    const [current, depth] = stack.pop()!;
    if (depth > max) max = depth;
    if (depth > MAX_CONTENT_DEPTH) return depth;
    if (current && typeof current === 'object') {
      for (const child of Object.values(current)) {
        if (child && typeof child === 'object') stack.push([child, depth + 1]);
      }
    }
  }
  return max;
}

/** Validates a Tiptap document against the allowlist. Use for request bodies and before rendering. */
export const contentDocSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (depthOf(value) > MAX_CONTENT_DEPTH) {
      ctx.addIssue({ code: 'custom', message: `Content nesting exceeds ${MAX_CONTENT_DEPTH} levels`, abort: true });
    }
  })
  .pipe(docNodeSchema);

/** True if the document contains any non-whitespace text (used to block publishing empty articles). */
export function hasText(doc: ContentDoc): boolean {
  const stack: unknown[] = [...(doc.content ?? [])];
  while (stack.length > 0) {
    const node = stack.pop() as { type?: string; text?: string; content?: unknown[] };
    if (node.type === 'text' && node.text?.trim()) return true;
    if (Array.isArray(node.content)) stack.push(...node.content);
  }
  return false;
}
