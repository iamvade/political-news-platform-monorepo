import messages from '../../messages/mn.json';
import { renderShareCard, SHARE_CARD_SIZE } from '@/lib/share-card';

// Default share card for Facebook / X when a page has no image of its own (the homepage, profiles without a
// photo). Articles without a cover get their own headline card (news/[idSlug]/share-card).

export const alt = messages.site.name;
export const size = SHARE_CARD_SIZE;
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  return renderShareCard({ title: messages.site.name, subtitle: messages.site.tagline });
}
