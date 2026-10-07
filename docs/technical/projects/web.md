# Public website (`apps/web`)

## Overview

**Scaffold.** Next.js App Router site. Today one dynamic page renders the API readiness status in Mongolian. Article, profile, organization and bill pages are not built yet; their public API routes exist ([public-api](../features/public-api.md)).

## How it works

- `src/lib/api.ts` — server-only client (`import 'server-only'`) built lazily from `API_URL`, so `next build` does not need the API.
- `src/i18n/request.ts` — next-intl with a single `mn` locale and no URL prefix; time zone `Asia/Ulaanbaatar`.
- `src/app/layout.tsx` — `<html lang="mn">`, Noto Sans with the `cyrillic-ext` subset (needed for Ө ө Ү ү).
- Tailwind 4 via `@tailwindcss/postcss`.

## Tech used

Next.js 16, React 19, next-intl 4, Tailwind CSS 4, `@news/shared`.

## How to start

```bash
pnpm -F @news/web dev        # http://localhost:3000 (API_URL in apps/web/.env)
pnpm -F @news/web build
```

## How to maintain

- UI strings in `messages/mn.json`.
- Fetch data with `getApi().public.*` from server components. Article pages should use ISR with tag revalidation (`article:<id>`, `home`) to match the API's revalidate jobs.
- Images: use `cover.variants` for `srcset` (WebP 320–1600) and `cover.url` (1024) as the default.

## Notables

- The API's revalidate jobs POST `{ tags }` with header `x-revalidate-secret` to `WEB_REVALIDATE_URL`; **the Next.js route that receives it does not exist yet**.
- Public API responses already carry Cloudflare-friendly `Cache-Control`; do not add per-user data to server-rendered HTML.
- `typecheck` runs `next typegen` first so route types exist.
- Article `bodyHtml` from the API contains real embed iframes (YouTube nocookie, Facebook plugins). The web must **not** use them as they are; see the click-to-load follow-up below. When a Content-Security-Policy is added, `frame-src` must allow `https://www.youtube-nocookie.com https://www.facebook.com` for the iframes loaded after a tap. Style hooks: `figure.image`, `figure.embed` (`.embed-youtube` / `.embed-facebook`), `figure.pull-quote`, `span.credit`.
- **Follow-up: article embeds are click-to-load (decided 2026-10-07).** A Facebook iframe loads Facebook's code, which also lets Facebook see the visit, for every reader. YouTube's player is hundreds of KB even with nocookie. Both hurt privacy and the LCP < 2.5 s target (PRD §10). When building the article page:
  - Render `embed` nodes from `bodyJson`, not from the iframes in `bodyHtml`. Each becomes a preview card: provider name, a play/open button and a link to the canonical URL.
  - The iframe is created only after the tap, with `src` from `parseEmbedUrl(url).embedSrc` (`@news/shared/content`).
  - The card loads **no third-party resource** before the tap. That includes YouTube thumbnails from `i.ytimg.com`: use a neutral card, or later a thumbnail served from our own media.
  - The same rule applies to YouTube and Facebook. Card strings go in `messages/mn.json`.

## Key files

`src/app/{layout,page}.tsx`, `src/lib/api.ts`, `src/i18n/request.ts`, `messages/mn.json`, `next.config.ts`.

---
Last updated: 2026-10-07 — click-to-load decision for article embeds; CSP note updated.
