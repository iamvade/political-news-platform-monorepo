import type { ContentDoc } from '@news/shared/content';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaPickerDialog } from '@/components/media-picker-dialog';
import { variantUrl } from '@/lib/media';
import { EmbedDialog } from './embed-dialog';
import { articleExtensions } from './extensions';
import { LinkDialog, type LinkValue } from './link-dialog';
import type { MediaImageAttrs } from './media-image';
import { Toolbar } from './toolbar';

interface RichTextEditorProps {
  /** Read once on mount; remount (change `key`) to load a different document. */
  initialContent: ContentDoc;
  editable: boolean;
  onChange: (doc: JSONContent) => void;
}

/** Inline images use the variant closest to the article column width. */
const INLINE_IMAGE_WIDTH = 1024;

export function RichTextEditor({ initialContent, editable, onChange }: RichTextEditorProps) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'link' | 'image' | 'embed' | null>(null);
  const [linkInitial, setLinkInitial] = useState<LinkValue | null>(null);

  const editor = useEditor({
    extensions: articleExtensions(t('editor.placeholder')),
    content: initialContent as JSONContent,
    editable,
    editorProps: {
      attributes: { class: 'article-content min-h-96 px-4 py-3 outline-none', 'aria-label': t('editor.bodyLabel'), role: 'textbox', 'aria-multiline': 'true' },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  if (!editor) return null;

  function openLink() {
    const attrs = editor!.getAttributes('link') as { href?: string; target?: string | null };
    setLinkInitial(attrs.href ? { href: attrs.href, newTab: attrs.target === '_blank' } : null);
    setDialog('link');
  }

  return (
    <div className="rounded-md border bg-background">
      <Toolbar editor={editor} onLink={openLink} onImage={() => setDialog('image')} onEmbed={() => setDialog('embed')} />
      <EditorContent editor={editor} />

      <LinkDialog
        open={dialog === 'link'}
        onOpenChange={(open) => setDialog(open ? 'link' : null)}
        initial={linkInitial}
        onSubmit={({ href, newTab }) => {
          editor.chain().focus().extendMarkRange('link').setLink({ href, target: newTab ? '_blank' : null }).run();
          setDialog(null);
        }}
        onRemove={() => {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          setDialog(null);
        }}
      />
      <EmbedDialog
        open={dialog === 'embed'}
        onOpenChange={(open) => setDialog(open ? 'embed' : null)}
        onSubmit={(embed) => {
          editor.chain().focus().insertContent({ type: 'embed', attrs: { provider: embed.provider, url: embed.url } }).run();
          setDialog(null);
        }}
      />
      <MediaPickerDialog
        open={dialog === 'image'}
        onOpenChange={(open) => setDialog(open ? 'image' : null)}
        purpose="inline"
        onSelect={(media, { caption }) => {
          const src = variantUrl(media, INLINE_IMAGE_WIDTH);
          if (!src) return;
          const attrs: MediaImageAttrs = { src, alt: media.alt, mediaId: media.id, caption, credit: media.credit };
          editor.chain().focus().insertContent({ type: 'image', attrs }).run();
        }}
      />
    </div>
  );
}
