# Public website (`apps/web`)

## Overview

**Homepage, article, person and section pages built.** This is the Next.js App Router site. It has:
- the [design system](../features/design-system.md): fonts, colour tokens with light and dark themes, components, `/styleguide`
- the site header and footer around every page
- the [public pages](../features/public-site.md): `/`, `/news/{id}-{slug}`, `/person/{id}-{slug}`, `/section/{slug}[/{n}]`, with tagged data caching, `/api/revalidate`, SEO metadata, JSON-LD and a generated share image

Party, tag, bill and search pages aren't built yet; their public API routes mostly exist ([public-api](../features/public-api.md)).

## How it works

- `src/lib/env.ts`: server env validated with Zod on first use (`API_URL`, `SITE_URL`, `WEB_REVALIDATE_SECRET`, `FACEBOOK_APP_ID`).
- `src/lib/api.ts`: server-only client (`import 'server-only'`) built lazily from `API_URL`, so `next build` does not need the API.
- `src/lib/data.ts`: the page loaders. Each one fetches with `force-cache` and per-entity tags; revalidation flow in [public-site](../features/public-site.md).
- `src/i18n/request.ts` — next-intl with a single `mn` locale and no URL prefix; time zone `Asia/Ulaanbaatar`.
- `src/app/layout.tsx`:
  - `<html lang="mn">` with Source Serif 4 + Inter (the `cyrillic-ext` subset, needed for Ө ө Ү ү, is verified in the built files)
  - the inline theme script
  - `SiteHeader` and `SiteFooter`
  - `NextIntlClientProvider`, which only passes the `nav`, `theme` and `errors` messages to client components
  - root metadata: `metadataBase` from `SITE_URL`, title template, Open Graph and Twitter defaults
- Tailwind 4 via `@tailwindcss/postcss`. Tokens and type utilities are in `src/app/globals.css`, documented in [design-system](../features/design-system.md).
- Components are in `src/components/` (homepage sections in `components/home/`) and helpers in `src/lib/` (`routes`, `media`, `pagination`, `theme`, `seo`, `article-html`).
- `/styleguide` is noindex, and 404 in production unless `STYLEGUIDE_ENABLED=true` at build time.

## Tech used

Next.js 16, React 19, next-intl 4, Tailwind CSS 4, Zod 4 (env, revalidate body), `@news/shared`. Tests: Vitest, Testing Library and jsdom (the same versions as the admin).

## How to start

```bash
pnpm -F @news/web dev        # http://localhost:3000 (API_URL in apps/web/.env); /styleguide
pnpm -F @news/web test       # Vitest (jsdom; server modules use the node environment)
pnpm -F @news/web build      # SITE_URL must be set (production mode)
pnpm -F @news/web start
```

## How to maintain

- UI strings go in `messages/mn.json`.
- Build pages from the design-system components and token utilities only, with no raw colours. A new client component's message namespace has to be added to the provider in `layout.tsx`.
- Environment variables (`.env.example`):
  - `API_URL` (server, required)
  - `SITE_URL` (absolute public origin; required in production, `http://localhost:3000` otherwise)
  - `WEB_REVALIDATE_SECRET` (≥ 32 chars, the same value as the API's; `/api/revalidate` answers 503 without it)
  - `FACEBOOK_APP_ID` (optional, digits; adds `fb:app_id` to every page)
  - `STYLEGUIDE_ENABLED` (optional, read at build time)
- Fetch data through the loaders in `lib/data.ts`, never `getApi()` directly from a page, so every fetch has cache tags. New data needs a tag that the API sends on change ([public-site](../features/public-site.md#how-to-maintain)).
- Images: use `cover.variants` for `srcset` (WebP 320–1600) and `cover.url` (1024) as the default.

## Notables

- Public API responses already carry Cloudflare-friendly `Cache-Control`; do not add per-user data to server-rendered HTML.
- `typecheck` runs `next typegen` first so route types exist.
- `next dev` may rewrite `AGENTS.md` (Next's agent notes); commit it as is.
- About 185 KB gzip of JS loads per page today, mostly the React/Next runtime; the PRD target is under 150 KB for articles. About 103 KB of fonts are preloaded (Source Serif 4 only; Inter loads on demand). See [design-system](../features/design-system.md#notables).
- **Article embeds are click-to-load (decided 2026-10-07).** A Facebook iframe loads Facebook's code, which also lets Facebook see the visit, for every reader. YouTube's player is hundreds of KB even with nocookie. Both hurt privacy and the LCP < 2.5 s target (PRD §10).
  - The body comes from the API's sanitized `bodyHtml`. A server transform (`lib/article-html.ts`) swaps each allowlisted iframe for a neutral button that loads **no third-party resource** (no `i.ytimg.com` thumbnails either).
  - `EmbedActivator` creates the iframe after the tap. Details: [public-site](../features/public-site.md#article-body-and-embeds).
  - When a Content-Security-Policy is added, `frame-src` must allow `https://www.youtube-nocookie.com https://www.facebook.com`.
  - Style hooks: `figure.image`, `figure.embed` (`.embed-youtube` / `.embed-facebook`), `button.embed-load`, `figure.pull-quote`, `span.credit`.
- Server modules (`lib/data.ts`, `lib/env.ts`) import `server-only`; the Vitest setup mocks it and `next/navigation`'s `notFound`.
- `next build` runs in production mode, so `SITE_URL` must be set even for a local build (`apps/web/.env` or inline).

## Key files

`src/app/(home)/`, `src/app/{layout,error,not-found,opengraph-image,globals.css}`, `src/app/news/`, `src/app/person/`, `src/app/section/`, `src/app/api/revalidate/`, `src/app/styleguide/`, `src/components/`, `src/lib/{env,api,data,cache-tags,seo,site,article-html,theme,routes,media,pagination}.ts`, `src/lib/share-card.tsx`, `src/assets/fonts/`, `src/design/`, `src/i18n/request.ts`, `src/test/`, `messages/mn.json`, `next.config.ts`, `vitest.config.ts`.

---
Last updated: 2026-10-08 — section pages ([public-site](../features/public-site.md)). Earlier the same day: `FACEBOOK_APP_ID`; article share cards and related rail ([public-site](../features/public-site.md)). Earlier: homepage, article and person pages; `/api/revalidate`; `SITE_URL` and `WEB_REVALIDATE_SECRET`; click-to-load embeds; design system, /styleguide.
