import { mergeAttributes, Node, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

function PullQuoteView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const attribution = (node.attrs.attribution as string | null) ?? '';
  return (
    <NodeViewWrapper as="figure" className="my-6 border-l-4 border-primary pl-4" data-pull-quote>
      <NodeViewContent<"blockquote"> as="blockquote" className="text-lg font-medium italic" />
      <div contentEditable={false} className="mt-2 max-w-sm">
        <Input
          value={attribution}
          onChange={(event) => updateAttributes({ attribution: event.target.value || null })}
          placeholder={t('editor.pullQuote.attribution')}
          aria-label={t('editor.pullQuote.attribution')}
          maxLength={300}
          disabled={!editor.isEditable}
        />
      </div>
    </NodeViewWrapper>
  );
}

/** Highlighted quote with an optional attribution (renders as `<figure class="pull-quote">`). */
export const PullQuote = Node.create({
  name: 'pullQuote',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      attribution: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-attribution'),
        renderHTML: (a) => (a.attribution ? { 'data-attribution': a.attribution } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-pull-quote]', contentElement: 'blockquote' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-pull-quote': '' }), ['blockquote', 0]];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PullQuoteView);
  },
});
