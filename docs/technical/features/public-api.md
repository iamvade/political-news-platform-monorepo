# Public read API

## Overview

**Built.** Unauthenticated, CDN-cacheable reads for the website and app under `/v1/public`. Only published articles and live (not soft-deleted) records are exposed; responses never contain internal fields.

## How it works

| Route | Returns | Cache preset |
|---|---|---|
| `GET /homepage` | The live layout resolved for readers: `hero`, `featured` (4), `sections` (`[{ category, articles }]`, 6 each), `updatedAt`. See [homepage](homepage.md) | news |
| `GET /articles?category=&tag=&page=&pageSize=` | Published articles, newest first | news |
| `GET /articles/:slug` | Article with `bodyHtml`, `bodyJson`, author name, category, tags, persons, organizations, bills, public corrections. `bodyHtml` may contain `<figure>`/`<figcaption>` and **allowlisted iframes** (`www.youtube-nocookie.com/embed/…`, `www.facebook.com/plugins/{post,video}.php`). The web turns these iframes into click-to-load buttons before rendering ([public-site](public-site.md#article-body-and-embeds)) | news |
| `GET /categories/:slug`, `GET /tags/:slug` | The category/tag | news |
| `GET /categories/:slug/articles`, `GET /tags/:slug/articles` | Its published articles (paginated) | news |
| `GET /persons/:slug` | Profile: names, photo, current positions, derived `party` and `constituency` | profile |
| `GET /persons/:slug/{positions,votes,statements,promises,declarations}` | Paginated history | profile |
| `GET /persons/:slug/articles` | Published articles tagging the person | news |
| `GET /organizations/:slug` | Organization, parent, logo, **current members** | profile |
| `GET /bills/:slug` | Bill, sponsors, stages (oldest first), votes grouped by `(date, motion)` with tallies | profile |
| `GET /parliament/week` | "Parliament this week": `{ from, to, stages, votes }` for the 7 calendar days ending today in Asia/Ulaanbaatar. `stages`: bill stage changes (`bill {slug, titleMn}`, `stage`, `date`, `noteMn`, `sourceUrl`), newest first. `votes`: roll calls grouped by `(bill, date, motion)` with `tally` and one `sourceUrl`, newest first. Like `/bills/:slug`, votes of soft-deleted persons are not counted | news |

- **404 vs 410**: an article that was never published → 404; one that was published and later unpublished → 410 `GONE`.
- Person references (`PublicPersonRef`: article persons, organization members, bill sponsors and votes, statements) carry the numeric `id`, so clients can build `/person/{id}-{slug}` URLs.
- Statements link their article only if it is currently published.
- Media fields (`cover`, `photo`, `logo`) contain only `ready` media: `url` (the 1024 px WebP variant) and `variants` for `srcset`. URLs need `MEDIA_PUBLIC_BASE_URL`; originals are never exposed.

### Cache-Control (`lib/cache.ts`, `onSend` hook on the public scope)

| Response | Header |
|---|---|
| 2xx, preset `news` | `public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400` |
| 2xx, preset `profile` | `public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400` |
| 404 | `public, max-age=30, s-maxage=60` |
| 410 | `public, max-age=300, s-maxage=3600` |
| other 4xx/5xx | `no-store` |

Cloudflare uses `s-maxage` as the edge TTL and browsers use `max-age`; `stale-if-error` keeps pages served from the edge if the origin is down.

## Tech used

Fastify route `config.cache`, shared public DTO schemas (`packages/shared/src/schemas/public.ts`), Drizzle joins with soft-delete filters.

## How to start

```bash
curl -i localhost:4000/v1/public/persons/d-sarantuya
curl -s localhost:4000/v1/public/bills/tax-general-law-amendment-2025 | jq '.data.votes[].tally'
```

(Slugs from the dev seed.)

## How to maintain

- New public route: put it in the domain's `public.routes.ts`, choose `config: { cache: 'news' | 'profile' }`, declare 404/410 responses, define the DTO in `schemas/public.ts` (reader-facing fields only), and add tests to `apps/api/src/modules/public.test.ts` including the Cache-Control header.
- Anything that changes content shown on a cached web page must send the matching web cache tag after commit (`revalidateAfterCommit`, [public-site](public-site.md#revalidation-srcappapirevalidateroutets)).

## Notables

- Site URLs are `/news/<id>-<slug>` and `/person/<id>-<slug>` (id canonical); the API looks records up by slug, and the web checks that the returned id matches.
- Unknown routes (no matching endpoint) are answered by the global 404 handler and get no cache header.
- Follow-ups: ETags, CDN purge on profile/bill changes, Latin-typed search, English DTO fields.

## Key files

`apps/api/src/modules/{articles,taxonomy,people,legislation}/public.*.ts`, `apps/api/src/lib/{cache,media}.ts`, `packages/shared/src/schemas/public.ts`.

---
Last updated: 2026-10-07 — `/parliament/week`; person refs carry `id`; revalidation note. Earlier: `/homepage`, figures and embed iframes in `bodyHtml`.
