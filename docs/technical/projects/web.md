# Public website (`apps/web`)

## Overview

**Design system built, pages pending.** This is the Next.js App Router site. It has:
- the [design system](../features/design-system.md): fonts, colour tokens with light and dark themes, components, `/styleguide`
- the site header and footer around every page
- a home page that still shows the API readiness status

Article, profile, organization and bill pages aren't built yet; their public API routes exist ([public-api](../features/public-api.md)).

## How it works

- `src/lib/api.ts` — server-only client (`import 'server-only'`) built lazily from `API_URL`, so `next build` does not need the API.
- `src/i18n/request.ts` — next-intl with a single `mn` locale and no URL prefix; time zone `Asia/Ulaanbaatar`.
- `src/app/layout.tsx`:
  - `<html lang="mn">` with Source Serif 4 + Inter (the `cyrillic-ext` subset, needed for Ө ө Ү ү, is verified in the built files)
  - the inline theme script
  - `SiteHeader` and `SiteFooter`
  - `NextIntlClientProvider`, which only passes the `nav` and `theme` messages to client components
- Tailwind 4 via `@tailwindcss/postcss`. Tokens and type utilities are in `src/app/globals.css`, documented in [design-system](../features/design-system.md).
- Components are in `src/components/` and helpers in `src/lib/` (`routes`, `media`, `pagination`, `theme`).
- `/styleguide` is noindex, and 404 in production unless `STYLEGUIDE_ENABLED=true` at build time.

## Tech used

Next.js 16, React 19, next-intl 4, Tailwind CSS 4, `@news/shared`. Tests: Vitest, Testing Library and jsdom (the same versions as the admin).

## How to start

```bash
pnpm -F @news/web dev        # http://localhost:3000 (API_URL in apps/web/.env); /styleguide
pnpm -F @news/web test       # Vitest (jsdom)
pnpm -F @news/web build
```

## How to maintain

- UI strings go in `messages/mn.json`.
- Build pages from the design-system components and token utilities only, with no raw colours. A new client component's message namespace has to be added to the provider in `layout.tsx`.
- Environment variables:
  - `API_URL` (server)
  - `STYLEGUIDE_ENABLED` (optional, read at build time)
- Fetch data with `getApi().public.*` from server components. Article pages should use ISR with tag revalidation (`article:<id>`, `home`) to match the API's revalidate jobs.
- Images: use `cover.variants` for `srcset` (WebP 320–1600) and `cover.url` (1024) as the default.

## Notables

- The API's revalidate jobs POST `{ tags }` with header `x-revalidate-secret` to `WEB_REVALIDATE_URL`; **the Next.js route that receives it does not exist yet**.
- Public API responses already carry Cloudflare-friendly `Cache-Control`; do not add per-user data to server-rendered HTML.
- `typecheck` runs `next typegen` first so route types exist.
- `next dev` may rewrite `AGENTS.md` (Next's agent notes); commit it as is.
- About 185 KB gzip of JS loads per page today, mostly the React/Next runtime; the PRD target is under 150 KB for articles. About 103 KB of fonts are preloaded (Source Serif 4 only; Inter loads on demand). See [design-system](../features/design-system.md#notables).
- Article `bodyHtml` from the API contains real embed iframes (YouTube nocookie, Facebook plugins). The web must **not** use them as they are; see the click-to-load follow-up below. When a Content-Security-Policy is added, `frame-src` must allow `https://www.youtube-nocookie.com https://www.facebook.com` for the iframes loaded after a tap. Style hooks: `figure.image`, `figure.embed` (`.embed-youtube` / `.embed-facebook`), `figure.pull-quote`, `span.credit`.
- **Follow-up: article embeds are click-to-load (decided 2026-10-07).** A Facebook iframe loads Facebook's code, which also lets Facebook see the visit, for every reader. YouTube's player is hundreds of KB even with nocookie. Both hurt privacy and the LCP < 2.5 s target (PRD §10). When building the article page:
  - Render `embed` nodes from `bodyJson`, not from the iframes in `bodyHtml`. Each becomes a preview card: provider name, a play/open button and a link to the canonical URL.
  - The iframe is created only after the tap, with `src` from `parseEmbedUrl(url).embedSrc` (`@news/shared/content`).
  - The card loads **no third-party resource** before the tap. That includes YouTube thumbnails from `i.ytimg.com`: use a neutral card, or later a thumbnail served from our own media.
  - The same rule applies to YouTube and Facebook. Card strings go in `messages/mn.json`.

## Key files

`src/app/{layout,page,globals.css}`, `src/app/styleguide/`, `src/components/`, `src/lib/{api,theme,routes,media,pagination}.ts`, `src/design/`, `src/i18n/request.ts`, `src/test/`, `messages/mn.json`, `next.config.ts`, `vitest.config.ts`.

---
Last updated: 2026-10-07 — only the serif font is preloaded; design system, header/footer, /styleguide, Vitest setup.
