import type { z } from 'zod';
import { authSessionResponseSchema, type LoginBody } from '../schemas/auth';
import {
  articleListResponseSchema,
  articleResponseSchema,
  articleRevisionListResponseSchema,
  type ArticleListQuery,
  type CreateArticleBody,
  type RestoreRevisionBody,
  type ReturnToDraftBody,
  type ScheduleArticleBody,
  type UpdateArticleBody,
} from '../schemas/articles';
import { errorResponseSchema, noContentSchema } from '../schemas/common';
import * as corr from '../schemas/corrections';
import { importResultResponseSchema, type PositionImportBody, type VoteImportBody } from '../schemas/imports';
import * as leg from '../schemas/legislation';
import {
  lookupResponseSchema,
  taxonomyItemResponseSchema,
  type CreateTagBody,
  type LookupKind,
  type LookupQuery,
} from '../schemas/lookup';
import {
  adminMediaListResponseSchema,
  adminMediaResponseSchema,
  mediaMimeTypeSchema,
  requestUploadResponseSchema,
  type RequestUploadBody,
  type UpdateMediaBody,
} from '../schemas/media';
import * as ppl from '../schemas/people';
import * as pub from '../schemas/public';
import * as rec from '../schemas/records';
import { healthResponseSchema, readinessResponseSchema } from '../schemas/health';
import { ApiError, ClientErrorCode } from './errors';

export interface ApiClientOptions {
  /** API origin, e.g. `http://localhost:4000`. No trailing path. */
  baseUrl: string;
  /** Override fetch (tests, Next.js server fetch, etc.). Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** `include` for the admin app so the session cookie is sent. */
  credentials?: RequestCredentials;
  headers?: HeadersInit;
  /** Admin only: returns the current CSRF token, sent as `X-CSRF-Token` on non-GET requests. */
  getCsrfToken?: () => string | undefined;
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: QueryParams;
  body?: unknown;
  /** Response body schema; the parsed value is returned. */
  schema: S;
  signal?: AbortSignal;
  /** Extra fetch options, e.g. Next.js `{ next: { revalidate: 60 } }`. */
  init?: RequestInit;
}

/** Per-call options exposed on endpoint helpers. */
export type CallOptions = Pick<RequestOptions<z.ZodType>, 'signal' | 'init'>;

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  async function request<S extends z.ZodType>(path: string, opts: RequestOptions<S>): Promise<z.infer<S>> {
    const url = buildUrl(baseUrl, path, opts.query);
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json');
    const method = opts.method ?? 'GET';
    if (method !== 'GET') {
      const csrfToken = options.getCsrfToken?.();
      if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
    }

    let res: Response;
    try {
      res = await doFetch(url, {
        ...opts.init,
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        credentials: options.credentials,
        signal: opts.signal,
      });
    } catch (err) {
      throw new ApiError(0, ClientErrorCode.NETWORK_ERROR, err instanceof Error ? err.message : 'Network error');
    }

    const json = await readJson(res);

    if (!res.ok) {
      const parsed = errorResponseSchema.safeParse(json);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError(res.status, code, message, details);
      }
      throw new ApiError(res.status, ClientErrorCode.HTTP_ERROR, `HTTP ${res.status}`);
    }

    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(res.status, ClientErrorCode.INVALID_RESPONSE, `Unexpected response shape from ${path}`);
    }
    return parsed.data;
  }

  /** list / get / create / update / remove for one admin resource. */
  function adminResource<Item extends z.ZodType, List extends z.ZodType, Create, Update>(
    path: string,
    itemSchema: Item,
    listSchema: List,
  ) {
    return {
      list: (query: QueryParams = {}, call?: CallOptions) => request(path, { query, schema: listSchema, ...call }),
      get: (id: number, call?: CallOptions) => request(`${path}/${id}`, { schema: itemSchema, ...call }),
      create: (body: Create, call?: CallOptions) => request(path, { method: 'POST', body, schema: itemSchema, ...call }),
      update: (id: number, body: Update, call?: CallOptions) =>
        request(`${path}/${id}`, { method: 'PATCH', body, schema: itemSchema, ...call }),
      remove: (id: number, call?: CallOptions) => request(`${path}/${id}`, { method: 'DELETE', schema: noContentSchema, ...call }),
    };
  }

  const page = (q: { page?: number; pageSize?: number } = {}) => ({ page: q.page, pageSize: q.pageSize });

  return {
    request,
    health: {
      get: (call?: CallOptions) => request('/health', { schema: healthResponseSchema, ...call }),
      ready: (call?: CallOptions) => request('/health/ready', { schema: readinessResponseSchema, ...call }),
    },
    auth: {
      login: (body: LoginBody, call?: CallOptions) =>
        request('/v1/admin/auth/login', { method: 'POST', body, schema: authSessionResponseSchema, ...call }),
      me: (call?: CallOptions) => request('/v1/admin/auth/me', { schema: authSessionResponseSchema, ...call }),
      logout: (call?: CallOptions) =>
        request('/v1/admin/auth/logout', { method: 'POST', schema: noContentSchema, ...call }),
    },
    articles: {
      list: (query: Partial<ArticleListQuery> = {}, call?: CallOptions) =>
        request('/v1/admin/articles', { query, schema: articleListResponseSchema, ...call }),
      get: (id: number, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}`, { schema: articleResponseSchema, ...call }),
      create: (body: CreateArticleBody, call?: CallOptions) =>
        request('/v1/admin/articles', { method: 'POST', body, schema: articleResponseSchema, ...call }),
      update: (id: number, body: UpdateArticleBody, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}`, { method: 'PATCH', body, schema: articleResponseSchema, ...call }),
      submit: (id: number, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/submit`, { method: 'POST', schema: articleResponseSchema, ...call }),
      returnToDraft: (id: number, body: ReturnToDraftBody = {}, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/return-to-draft`, {
          method: 'POST',
          body,
          schema: articleResponseSchema,
          ...call,
        }),
      publish: (id: number, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/publish`, { method: 'POST', schema: articleResponseSchema, ...call }),
      schedule: (id: number, body: ScheduleArticleBody, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/schedule`, {
          method: 'POST',
          body,
          schema: articleResponseSchema,
          ...call,
        }),
      unpublish: (id: number, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/unpublish`, { method: 'POST', schema: articleResponseSchema, ...call }),
      revisions: (id: number, query: { page?: number; pageSize?: number } = {}, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/revisions`, { query, schema: articleRevisionListResponseSchema, ...call }),
      restoreRevision: (id: number, revisionId: number, body: RestoreRevisionBody = {}, call?: CallOptions) =>
        request(`/v1/admin/articles/${id}/revisions/${revisionId}/restore`, {
          method: 'POST',
          body,
          schema: articleResponseSchema,
          ...call,
        }),
    },
    /** Political data (data_editor / admin). */
    admin: {
      persons: adminResource<typeof ppl.adminPersonResponseSchema, typeof ppl.adminPersonListResponseSchema, ppl.CreatePersonBody, ppl.UpdatePersonBody>(
        '/v1/admin/persons',
        ppl.adminPersonResponseSchema,
        ppl.adminPersonListResponseSchema,
      ),
      organizations: adminResource<
        typeof ppl.adminOrganizationResponseSchema,
        typeof ppl.adminOrganizationListResponseSchema,
        ppl.CreateOrganizationBody,
        ppl.UpdateOrganizationBody
      >('/v1/admin/organizations', ppl.adminOrganizationResponseSchema, ppl.adminOrganizationListResponseSchema),
      positions: adminResource<
        typeof ppl.adminPositionResponseSchema,
        typeof ppl.adminPositionListResponseSchema,
        ppl.CreatePositionBody,
        ppl.UpdatePositionBody
      >('/v1/admin/positions', ppl.adminPositionResponseSchema, ppl.adminPositionListResponseSchema),
      bills: {
        ...adminResource<typeof leg.adminBillResponseSchema, typeof leg.adminBillListResponseSchema, leg.CreateBillBody, leg.UpdateBillBody>(
          '/v1/admin/bills',
          leg.adminBillResponseSchema,
          leg.adminBillListResponseSchema,
        ),
        replaceSponsors: (id: number, body: leg.ReplaceSponsorsBody, call?: CallOptions) =>
          request(`/v1/admin/bills/${id}/sponsors`, { method: 'PUT', body, schema: leg.adminBillResponseSchema, ...call }),
      },
      billStages: adminResource<
        typeof leg.adminBillStageResponseSchema,
        typeof leg.adminBillStageListResponseSchema,
        leg.CreateBillStageBody,
        leg.UpdateBillStageBody
      >('/v1/admin/bill-stages', leg.adminBillStageResponseSchema, leg.adminBillStageListResponseSchema),
      votes: adminResource<typeof leg.adminVoteResponseSchema, typeof leg.adminVoteListResponseSchema, leg.CreateVoteBody, leg.UpdateVoteBody>(
        '/v1/admin/votes',
        leg.adminVoteResponseSchema,
        leg.adminVoteListResponseSchema,
      ),
      statements: adminResource<
        typeof rec.adminStatementResponseSchema,
        typeof rec.adminStatementListResponseSchema,
        rec.CreateStatementBody,
        rec.UpdateStatementBody
      >('/v1/admin/statements', rec.adminStatementResponseSchema, rec.adminStatementListResponseSchema),
      promises: adminResource<
        typeof rec.adminPromiseResponseSchema,
        typeof rec.adminPromiseListResponseSchema,
        rec.CreatePromiseBody,
        rec.UpdatePromiseBody
      >('/v1/admin/promises', rec.adminPromiseResponseSchema, rec.adminPromiseListResponseSchema),
      declarations: adminResource<
        typeof rec.adminDeclarationResponseSchema,
        typeof rec.adminDeclarationListResponseSchema,
        rec.CreateDeclarationBody,
        rec.UpdateDeclarationBody
      >('/v1/admin/declarations', rec.adminDeclarationResponseSchema, rec.adminDeclarationListResponseSchema),
      corrections: adminResource<
        typeof corr.adminCorrectionResponseSchema,
        typeof corr.adminCorrectionListResponseSchema,
        corr.CreateCorrectionBody,
        corr.UpdateCorrectionBody
      >('/v1/admin/corrections', corr.adminCorrectionResponseSchema, corr.adminCorrectionListResponseSchema),
      media: {
        requestUpload: (body: RequestUploadBody, call?: CallOptions) =>
          request('/v1/admin/media/uploads', { method: 'POST', body, schema: requestUploadResponseSchema, ...call }),
        confirm: (id: number, call?: CallOptions) =>
          request(`/v1/admin/media/${id}/confirm`, { method: 'POST', schema: adminMediaResponseSchema, ...call }),
        list: (query: { search?: string; status?: string; page?: number; pageSize?: number } = {}, call?: CallOptions) =>
          request('/v1/admin/media', { query, schema: adminMediaListResponseSchema, ...call }),
        get: (id: number, call?: CallOptions) => request(`/v1/admin/media/${id}`, { schema: adminMediaResponseSchema, ...call }),
        update: (id: number, body: UpdateMediaBody, call?: CallOptions) =>
          request(`/v1/admin/media/${id}`, { method: 'PATCH', body, schema: adminMediaResponseSchema, ...call }),
        /**
         * Full upload: presign → PUT the file straight to storage → confirm. Resolves with the media in `processing`;
         * variants appear once the background job finishes (poll `get`).
         */
        uploadFile: async (file: Blob, meta: { filename: string; alt?: string; credit?: string }, call?: CallOptions) => {
          const mimeType = mediaMimeTypeSchema.safeParse(file.type);
          if (!mimeType.success) throw new ApiError(0, ClientErrorCode.INVALID_RESPONSE, `Unsupported file type: ${file.type || 'unknown'}`);
          const { data } = await request('/v1/admin/media/uploads', {
            method: 'POST',
            body: { filename: meta.filename, mimeType: mimeType.data, byteSize: file.size, alt: meta.alt, credit: meta.credit },
            schema: requestUploadResponseSchema,
            ...call,
          });
          // Direct to storage: no API cookies or CSRF header, only the signed headers.
          let put: Response;
          try {
            put = await doFetch(data.upload.url, { method: 'PUT', headers: data.upload.headers, body: file, signal: call?.signal });
          } catch (err) {
            throw new ApiError(0, ClientErrorCode.NETWORK_ERROR, err instanceof Error ? err.message : 'Upload failed');
          }
          if (!put.ok) throw new ApiError(put.status, ClientErrorCode.HTTP_ERROR, `Upload to storage failed: HTTP ${put.status}`);
          return request(`/v1/admin/media/${data.media.id}/confirm`, { method: 'POST', schema: adminMediaResponseSchema, ...call });
        },
      },
      import: {
        votes: (body: VoteImportBody, call?: CallOptions) =>
          request('/v1/admin/votes/import', { method: 'POST', body, schema: importResultResponseSchema, ...call }),
        positions: (body: PositionImportBody, call?: CallOptions) =>
          request('/v1/admin/positions/import', { method: 'POST', body, schema: importResultResponseSchema, ...call }),
      },
    },
    /** Picker lookups for the editor (every newsroom role). */
    lookup: {
      search: (
        kind: LookupKind,
        query: { search?: string; ids?: number[]; limit?: LookupQuery['limit'] } = {},
        call?: CallOptions,
      ) =>
        request(`/v1/admin/lookup/${kind}`, {
          query: { search: query.search, ids: query.ids?.length ? query.ids.join(',') : undefined, limit: query.limit },
          schema: lookupResponseSchema,
          ...call,
        }),
    },
    taxonomy: {
      createTag: (body: CreateTagBody, call?: CallOptions) =>
        request('/v1/admin/tags', { method: 'POST', body, schema: taxonomyItemResponseSchema, ...call }),
    },
    /** Unauthenticated, CDN-cached reads for web and mobile. */
    public: {
      articles: {
        list: (query: { category?: string; tag?: string; page?: number; pageSize?: number } = {}, call?: CallOptions) =>
          request('/v1/public/articles', { query, schema: pub.publicArticleListResponseSchema, ...call }),
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/articles/${encodeURIComponent(slug)}`, { schema: pub.publicArticleResponseSchema, ...call }),
      },
      categories: {
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/categories/${encodeURIComponent(slug)}`, { schema: pub.publicTaxonomyResponseSchema, ...call }),
        articles: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/categories/${encodeURIComponent(slug)}/articles`, { query: page(q), schema: pub.publicArticleListResponseSchema, ...call }),
      },
      tags: {
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/tags/${encodeURIComponent(slug)}`, { schema: pub.publicTaxonomyResponseSchema, ...call }),
        articles: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/tags/${encodeURIComponent(slug)}/articles`, { query: page(q), schema: pub.publicArticleListResponseSchema, ...call }),
      },
      persons: {
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}`, { schema: pub.publicPersonResponseSchema, ...call }),
        positions: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/positions`, { query: page(q), schema: pub.publicPositionListResponseSchema, ...call }),
        articles: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/articles`, { query: page(q), schema: pub.publicArticleListResponseSchema, ...call }),
        votes: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/votes`, { query: page(q), schema: pub.publicPersonVoteListResponseSchema, ...call }),
        statements: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/statements`, { query: page(q), schema: pub.publicStatementListResponseSchema, ...call }),
        promises: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/promises`, { query: page(q), schema: pub.publicPromiseListResponseSchema, ...call }),
        declarations: (slug: string, q?: { page?: number; pageSize?: number }, call?: CallOptions) =>
          request(`/v1/public/persons/${encodeURIComponent(slug)}/declarations`, { query: page(q), schema: pub.publicDeclarationListResponseSchema, ...call }),
      },
      organizations: {
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/organizations/${encodeURIComponent(slug)}`, { schema: pub.publicOrganizationResponseSchema, ...call }),
      },
      bills: {
        get: (slug: string, call?: CallOptions) =>
          request(`/v1/public/bills/${encodeURIComponent(slug)}`, { schema: pub.publicBillResponseSchema, ...call }),
      },
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function readJson(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
