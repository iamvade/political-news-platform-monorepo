import { parseEmbedUrl, type EmbedProvider } from '@news/shared/content';
import { mergeAttributes, Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { cn } from 'cn';
import { SquarePlay } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface EmbedAttrs {
  provider: EmbedProvider;
  url: string;
}

function EmbedView({ node, selected }: NodeViewProps) {
  const { t } = useTranslation();
  const { provider, url } = node.attrs as EmbedAttrs;
  const parsed = parseEmbedUrl(url);
  return (
    <NodeViewWrapper className={cn('my-4 rounded-md border bg-muted/40 p-3', selected && 'ring-2 ring-ring')} data-drag-handle>
      <div contentEditable={false} className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SquarePlay className="size-4" aria-hidden />
          <span className="font-medium text-foreground">{t(`editor.embed.providers.${provider}`)}</span>
          <span className="truncate">{url}</span>
        </div>
        {parsed ? (
          // Preview only: clicks go to the node (select / delete), not into the iframe.
          <div className="pointer-events-none aspect-video w-full max-w-xl overflow-hidden rounded bg-background">
            <iframe src={parsed.embedSrc} title={t(`editor.embed.providers.${provider}`)} loading="lazy" className="size-full" />
          </div>
        ) : (
          <p className="text-sm text-destructive">{t('editor.embed.invalid')}</p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

/** YouTube / Facebook embed. Stores only the canonical URL; the iframe URL is derived when rendering. */
export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      provider: { default: null, parseHTML: (el) => el.getAttribute('data-provider'), renderHTML: (a) => ({ 'data-provider': a.provider }) },
      url: { default: null, parseHTML: (el) => el.getAttribute('data-url'), renderHTML: (a) => ({ 'data-url': a.url }) },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-embed': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});
