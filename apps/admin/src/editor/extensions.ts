import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { Embed } from './embed';
import { MediaImage } from './media-image';
import { PullQuote } from './pull-quote';

/** Links the content allowlist accepts (`link` mark in @news/shared/content). */
export const ALLOWED_LINK = /^(https?:\/\/|mailto:)/i;

/**
 * The editor's schema. Must stay in sync with the allowlist in @news/shared/content: a node or mark that is
 * not allowlisted there makes every save fail validation.
 */
export function articleExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [2, 3, 4] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        isAllowedUri: (url) => ALLOWED_LINK.test(url),
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      },
    }),
    MediaImage,
    Embed,
    PullQuote,
    Placeholder.configure({ placeholder }),
  ];
}
