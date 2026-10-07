import { ARTICLE_STATUSES, BILL_STATUSES, ErrorCode, MEDIA_STATUSES, ORGANIZATION_TYPES, USER_ROLES } from '@news/shared/schemas';
import { describe, expect, it } from 'vitest';
import mn from './locales/mn.json';
import { SECTIONS } from './navigation';

const has = (path: string) => path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], mn) !== undefined;

describe('Mongolian strings', () => {
  it('cover every API and client error code', () => {
    const codes = [...Object.values(ErrorCode), 'NETWORK_ERROR', 'HTTP_ERROR', 'INVALID_RESPONSE', 'UNKNOWN'];
    expect(codes.filter((code) => !has(`errors.${code}`))).toEqual([]);
  });

  it('cover every status, type, role and section', () => {
    const keys = [
      ...ARTICLE_STATUSES.map((s) => `status.article.${s}`),
      ...BILL_STATUSES.map((s) => `status.bill.${s}`),
      ...MEDIA_STATUSES.map((s) => `status.media.${s}`),
      ...ORGANIZATION_TYPES.map((s) => `status.organizationType.${s}`),
      ...USER_ROLES.map((r) => `roles.${r}`),
      ...SECTIONS.map((s) => `nav.${s.key}`),
    ];
    expect(keys.filter((key) => !has(key))).toEqual([]);
  });
});
