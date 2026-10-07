import { useEditorState, type Editor } from '@tiptap/react';
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquareQuote,
  Redo2,
  SquarePlay,
  TextQuote,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface ToolbarProps {
  editor: Editor;
  onLink: () => void;
  onImage: () => void;
  onEmbed: () => void;
}

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep the editor selection when clicking a button.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export function Toolbar({ editor, onLink, onImage, onEmbed }: ToolbarProps) {
  const { t } = useTranslation();
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      h4: e.isActive('heading', { level: 4 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      pullQuote: e.isActive('pullQuote'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const off = !state.editable;
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b p-1" role="toolbar" aria-label={t('editor.toolbar.label')}>
      <ToolButton icon={Heading2} label={t('editor.toolbar.h2')} active={state.h2} disabled={off} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label={t('editor.toolbar.h3')} active={state.h3} disabled={off} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <ToolButton icon={Heading4} label={t('editor.toolbar.h4')} active={state.h4} disabled={off} onClick={() => chain().toggleHeading({ level: 4 }).run()} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton icon={Bold} label={t('editor.toolbar.bold')} active={state.bold} disabled={off} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label={t('editor.toolbar.italic')} active={state.italic} disabled={off} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Link} label={t('editor.toolbar.link')} active={state.link} disabled={off} onClick={onLink} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton icon={List} label={t('editor.toolbar.bulletList')} active={state.bulletList} disabled={off} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label={t('editor.toolbar.orderedList')} active={state.orderedList} disabled={off} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={TextQuote} label={t('editor.toolbar.blockquote')} active={state.blockquote} disabled={off} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon={MessageSquareQuote} label={t('editor.toolbar.pullQuote')} active={state.pullQuote} disabled={off} onClick={() => chain().toggleNode('pullQuote', 'paragraph').run()} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton icon={Image} label={t('editor.toolbar.image')} disabled={off} onClick={onImage} />
      <ToolButton icon={SquarePlay} label={t('editor.toolbar.embed')} disabled={off} onClick={onEmbed} />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolButton icon={Undo2} label={t('editor.toolbar.undo')} disabled={off || !state.canUndo} onClick={() => chain().undo().run()} />
      <ToolButton icon={Redo2} label={t('editor.toolbar.redo')} disabled={off || !state.canRedo} onClick={() => chain().redo().run()} />
    </div>
  );
}
