import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { cn } from 'cn';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';

/** Attributes stored on the `image` node (see `ImageNode` in @news/shared/content). */
export interface MediaImageAttrs {
  src: string;
  alt: string | null;
  mediaId: number | null;
  caption: string | null;
  credit: string | null;
}

const dataAttribute = (name: string, parse: (value: string) => unknown = (v) => v) => ({
  default: null,
  parseHTML: (element: HTMLElement) => {
    const value = element.getAttribute(`data-${name}`);
    return value === null ? null : parse(value);
  },
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes[name] === null || attributes[name] === undefined ? {} : { [`data-${name}`]: String(attributes[name]) },
});

function MediaImageView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const { t } = useTranslation();
  const attrs = node.attrs as MediaImageAttrs;
  const readOnly = !editor.isEditable;
  return (
    <NodeViewWrapper as="figure" className={cn('my-4 rounded-md', selected && 'ring-2 ring-ring')} data-drag-handle>
      <img src={attrs.src} alt={attrs.alt ?? ''} className="max-h-96 w-full rounded-md bg-muted object-contain" />
      <div contentEditable={false} className="mt-2 grid gap-2 sm:grid-cols-2">
        <Input
          value={attrs.caption ?? ''}
          onChange={(event) => updateAttributes({ caption: event.target.value || null })}
          placeholder={t('editor.image.caption')}
          aria-label={t('editor.image.caption')}
          maxLength={1000}
          disabled={readOnly}
        />
        <Input
          value={attrs.credit ?? ''}
          onChange={(event) => updateAttributes({ credit: event.target.value || null })}
          placeholder={t('editor.image.credit')}
          aria-label={t('editor.image.credit')}
          maxLength={300}
          disabled={readOnly}
        />
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Block image from the media library. Pasted images are accepted only with an https `src`
 * (the content allowlist rejects anything else); data: URLs are off.
 */
export const MediaImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: dataAttribute('media-id', (v) => (/^\d+$/.test(v) ? Number(v) : null)),
      caption: dataAttribute('caption'),
      credit: dataAttribute('credit'),
    };
  },
  parseHTML() {
    return [{ tag: 'img[src^="https://"]' }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView);
  },
}).configure({ inline: false, allowBase64: false });
