import { contentDocSchema, type ContentDoc } from '@news/shared/content';
import type { Article, CreateArticleBody } from '@news/shared/schemas';
import { useSyncExternalStore } from 'react';

/** Everything the editor form edits. `bodyJson` is whatever Tiptap produced; it is validated on save. */
export interface ArticleFormValues {
  title: string;
  lede: string;
  bodyJson: unknown;
  categoryId: number | null;
  coverMediaId: number | null;
  isBreaking: boolean;
  tagIds: number[];
  personIds: number[];
  organizationIds: number[];
  billIds: number[];
}

export interface EditorState {
  /** Last state confirmed by the server (null until a new article is first saved). */
  article: Article | null;
  values: ArticleFormValues;
  /** Bumped on every local change; `savedVersion` is the version the server has. */
  version: number;
  savedVersion: number;
}

export const EMPTY_DOC: ContentDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export function valuesFromArticle(article: Article | null): ArticleFormValues {
  return {
    title: article?.title ?? '',
    lede: article?.lede ?? '',
    bodyJson: article?.bodyJson ?? EMPTY_DOC,
    categoryId: article?.categoryId ?? null,
    coverMediaId: article?.coverMediaId ?? null,
    isBreaking: article?.isBreaking ?? false,
    tagIds: article?.tagIds ?? [],
    personIds: article?.personIds ?? [],
    organizationIds: article?.organizationIds ?? [],
    billIds: article?.billIds ?? [],
  };
}

export type BodyError = 'titleRequired' | 'invalidBody';

/** Form values → request body, validating what the API would reject anyway. */
export function buildBody(values: ArticleFormValues): { body: CreateArticleBody } | { error: BodyError } {
  const title = values.title.trim();
  if (!title) return { error: 'titleRequired' };
  const doc = contentDocSchema.safeParse(values.bodyJson);
  if (!doc.success) return { error: 'invalidBody' };
  return {
    body: {
      title,
      lede: values.lede.trim() || null,
      bodyJson: doc.data,
      categoryId: values.categoryId,
      coverMediaId: values.coverMediaId,
      isBreaking: values.isBreaking,
      tagIds: values.tagIds,
      personIds: values.personIds,
      organizationIds: values.organizationIds,
      billIds: values.billIds,
    },
  };
}

export const isDirty = (state: EditorState) => state.version !== state.savedVersion;

export type EditorStore = ReturnType<typeof createEditorStore>;

/**
 * Tiny external store for one editor session (one per mounted editor). Saves and timers read `get()`
 * directly, so they always see the latest values without effect/ref plumbing.
 */
export function createEditorStore(article: Article | null) {
  let state: EditorState = { article, values: valuesFromArticle(article), version: 0, savedVersion: 0 };
  const listeners = new Set<() => void>();
  const set = (next: EditorState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch: Partial<ArticleFormValues>) {
      set({ ...state, values: { ...state.values, ...patch }, version: state.version + 1 });
    },
    /** The server now has `version` (later local edits stay dirty). */
    markSaved(version: number, saved: Article) {
      set({ ...state, article: saved, savedVersion: version });
    },
    /** New server state that does not touch the form (status transitions). */
    setArticle(saved: Article) {
      set({ ...state, article: saved });
    },
  };
}

export function useEditorState(store: EditorStore): EditorState {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
