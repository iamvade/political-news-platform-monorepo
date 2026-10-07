# Web design system

## Overview

**Built (apps/web).** This is the design system for the public site. It's serious, built for trust, and mobile-first (most readers arrive from Facebook on phones). It includes:
- self-hosted fonts that render Mongolian Cyrillic (Ө ө Ү ү)
- semantic colour tokens with light and dark themes (WCAG AA checked by a test)
- a type scale and a spacing scale
- the shared page components
- `/styleguide`, which shows all of it

No content pages use it yet; they'll be built on top of it.

## How it works

### Fonts

Both fonts come from `next/font/google` in `src/app/layout.tsx`, self-hosted at build time with `display: swap`:

| Font | Role | Subsets |
|---|---|---|
| **Source Serif 4** (variable `wght`) | Headlines, reading text (`font-serif`) | latin, cyrillic, cyrillic-ext |
| **Inter** (variable `wght`) | UI, labels, metadata, lede (`font-sans`) | latin, cyrillic, cyrillic-ext |

- **Glyph check (PRD §11.1).** The Mongolian letters live in `cyrillic-ext`. On 2026-10-07 the built `.next/static/media/*.woff2` files were inspected with fontTools: the cyrillic-ext file of each font contains U+04E8 Ө, U+04E9 ө, U+04AE Ү and U+04AF ү.
- **Re-checking after changing fonts:**
  ```bash
  python3 -m venv /tmp/ft && /tmp/ft/bin/pip install fonttools brotli
  /tmp/ft/bin/python -c "import sys;from fontTools.ttLib import TTFont as F;[print(p, all(c in F(p).getBestCmap() for c in (0x4E8,0x4E9,0x4AE,0x4AF))) for p in sys.argv[1:]]" apps/web/.next/static/media/*.woff2
  ```
  At least one file per font must print `True`.
- **Weight.** File sizes after the build (woff2):

  | Font | latin | cyrillic | cyrillic-ext | Preloaded? |
  |---|---|---|---|---|
  | Source Serif 4 | 49 KB | 35 KB | 17 KB | **yes**: 3 files, ~103 KB |
  | Inter | 47 KB | 18 KB | 25 KB | no (`preload: false`) |

  - **Only the serif is preloaded.** It sets the headlines, the likely text LCP. Inter loads when the CSS first needs it (`display: swap`, with an adjusted system fallback in the meantime), so it doesn't compete with the hero image for early bandwidth. Total bytes are unchanged.
  - **"Cyrillic only up front" doesn't help.** Digits and basic punctuation (`. , : ?`) are only in the Latin files, so every Mongolian page needs the Latin file too.
  - **The `opsz` axis is deliberately off:** with it, preloads were 345 KB.
  - **Italic** isn't loaded yet, so the browser would synthesize it. Add `style: ['normal', 'italic']` to the serif when article bodies need real italics.

### Colour tokens and themes

Tokens are defined in `src/app/globals.css` as CSS variables, in hex. Tailwind 4 `@theme inline` exposes them as utilities (`bg-canvas`, `text-ink-muted`, `border-border`, `bg-notice-bg`…).

| Token | Use |
|---|---|
| `canvas`, `surface`, `surface-muted` | Page background, cards and header, quiet panels and footer |
| `ink`, `ink-muted`, `ink-subtle` | Body text, secondary text, metadata |
| `border`, `border-strong` | Dividers, card outlines, hover outlines |
| `accent`, `accent-ink` | Brand (deep navy): rule under the header, current page, category labels; text on accent |
| `link` | Links |
| `focus` | Focus ring |
| `breaking`, `breaking-ink` | "Шуурхай" (breaking) label |
| `notice-bg`, `notice-border`, `notice-ink` | Correction notices |

- **Themes.** Light values sit on `:root` and `[data-theme=light]`. Dark values sit on `[data-theme=dark]`, and on `:root:not([data-theme=light])` under `prefers-color-scheme: dark`. Any element can carry `data-theme`, which is how `/styleguide` shows both themes side by side.
- **Components use tokens only.** Never use raw palette colours (`text-neutral-600`) or `dark:` variants. A `dark` custom variant exists for rare cases.
- **Contrast** (`src/design/tokens.test.ts`). The test parses `globals.css` and requires ≥ 4.5:1 for every text/background pair in both themes, ≥ 3:1 for the focus ring, and identical dark blocks. Current values:

  | Pair | Light | Dark |
  |---|---|---|
  | `ink` on `canvas` | 17.0 | 15.6 |
  | `ink-muted` on `canvas` | 9.8 | 10.1 |
  | `ink-subtle` on `surface-muted` (worst case) | 5.5 | 5.4 |
  | `link` on `canvas` | 8.0 | 9.2 |
  | `accent-ink` on `accent` | 11.5 | 8.7 |
  | `breaking-ink` on `breaking` | 6.5 | 6.5 |
  | `notice-ink` on `notice-bg` | 9.6 | 12.4 |

- **Reader toggle.**
  - `src/lib/theme.ts` holds a tiny inline script, rendered in `<head>`, that applies a saved `light`/`dark` choice from localStorage before first paint. Nothing is read on the server, so pages stay static/ISR-cacheable.
  - `components/theme-toggle.tsx` cycles auto → light → dark (`useSyncExternalStore` over localStorage). "Auto" removes the attribute and follows the phone setting.
  - `<html>` has `suppressHydrationWarning` because of the attribute.

### Type scale

These are `@utility` composites in `globals.css`. Sizes start at phone size and grow with `clamp()`.

| Utility | Font | Size (phone → desktop) | Use |
|---|---|---|---|
| `type-display` | serif 700 | 28 → 44 px | Page titles, lead headline |
| `type-headline` | serif 700 | 22 → 30 px | Section headings |
| `type-title` | serif 600 | 17 → 20 px | Card headlines |
| `type-lede` | sans 400 | 16 → 18 px | Lede / standfirst |
| `type-body` | serif 400 | 17 → 19 px, line-height 1.7 | Article text |
| `type-meta` | sans 13 px, tabular numbers | — | Dates, bylines, counts |
| `type-label` | sans 600 12 px, uppercase | — | Category and status labels |

### Spacing and layout

- **Spacing steps.** Use only these steps of Tailwind's 4px scale: 1, 2, 3, 4, 6, 8, 12, 16.
- **Page padding:** `px-gutter` (16px on phones, 24px from `md`).
- **Containers:** `max-w-page` (72rem) and `max-w-content` (42rem reading column).
- **Interaction:** touch targets are at least 44px (`min-h-11`, `size-11`). There's a global `:focus-visible` ring, and motion is reduced under `prefers-reduced-motion`.

### Components (`apps/web/src/components/`)

Server components, unless marked *client*. Labels come from `messages/mn.json`, and icons are inline SVG (`icons.tsx`), so there's no icon dependency.

| Component | Props | Notes |
|---|---|---|
| `SiteHeader` | — | Sticky, 56px. Wordmark (`site.name` is a placeholder until the brand is decided, PRD §13 Q1), desktop nav (≥ md), search link, theme toggle, navy rule |
| `NavLinks` *client* | `layout: 'bar' \| 'stack'` | `aria-current` from `usePathname` |
| `MobileMenu` *client* | — | Native `<details>`, which works without JS; keyed by pathname so it closes after navigation |
| `ThemeToggle` *client* | — | Auto / light / dark |
| `SiteFooter` | — | Trust pages (PRD §10): policy, methodology, ownership, corrections, right of reply, contact, legal |
| `ArticleCard` | `article: PublicArticleSummary`, `size: 'lead' \| 'standard' \| 'compact'`, `priority?`, `headingLevel?` | One stretched link per card. `<img srcset>` from the WebP variants (alt="" here; the headline is the link text). `priority` makes the image eager with high fetch priority, for the first lead card. Time in Ulaanbaatar |
| `PersonCard` | `person: PersonCardData` (slug, displayName, photo, role, party, constituency) | Initials when there is no photo; the party badge is not a nested link |
| `PartyBadge` | `party: PartyRef`, `link?` | Colour only as a dot; the short name is always written and the full name is the accessible name. Only `#RRGGBB` colours are used (anything else gives a neutral dot) |
| `Tag` | `tag: { slug, nameMn }` | Links to `/tag/{slug}` |
| `Breadcrumbs` | `items: { label, href? }[]` | Last item gets `aria-current="page"`; long labels truncate on phones |
| `Pagination` | `page`, `totalPages`, `hrefFor(page)` | Phones: prev · "3 / 12" · next. From `sm`: numbers with gaps (`lib/pagination.ts` `pageRange`). Disabled edges are spans |
| `SourceLink` | `href`, `variant: 'inline' \| 'icon'` | Host always visible or announced; new tab with `noopener noreferrer` |
| `CorrectionNotice` | `corrections: { date, description, reason }[]` | `aside role="note"`, newest first, links to `/corrections`; renders nothing when empty |

URL builders live in `lib/routes.ts` (PRD §7: `/news/{id}-{slug}`, `/person/{slug}`, `/party/{slug}`, `/tag/{slug}`…). Image `src`/`srcSet` come from `lib/media.ts`.

### /styleguide

`src/app/styleguide/` shows fonts with a Mongolian specimen, the type scale, colour swatches in both themes, the spacing scale, every component variant, and a dark-theme panel.
- It's always `noindex`.
- It returns **404 in production builds** unless `STYLEGUIDE_ENABLED=true` was set **at build time**: the page is static, so the check runs at build.
- Sample data (`samples.ts`) is fictional. Images are inline SVG data URIs.

## Tech used

Tailwind CSS 4 (`@theme inline`, `@utility`, `@custom-variant`), next/font, next-intl (`useTranslations` / `useFormatter` in server components), React 19 `useSyncExternalStore`. Tests use Vitest, Testing Library and jsdom.

## How to start

```bash
pnpm -F @news/web dev       # http://localhost:3000/styleguide
pnpm -F @news/web test
```

## How to maintain

- **New component:**
  - put it in `src/components/` as a server component unless it needs state
  - use token utilities and `type-*` classes; put labels in `messages/mn.json`
  - for a client component, add its message namespace to the `NextIntlClientProvider` in `layout.tsx`, which only passes `nav` and `theme` to the client
  - add a test (the test render helper throws on missing message keys) and a styleguide section
- **New or changed colour token:**
  - add it to the light block and to both dark blocks (the test checks they match)
  - map it in `@theme inline`
  - add text pairs to `PAIRS` in `tokens.test.ts`
- **Changing fonts:** keep `cyrillic-ext`, re-run the glyph check above, and re-measure what is preloaded. Next emits the preload hints into the RSC payload (`HL[...]`) of built pages:
  ```bash
  H=apps/web/.next/server/app/styleguide.html   # any prerendered page
  for f in $(grep -oE 'HL\[\\"/_next/static/media/[^\\]+' $H | sed 's/.*\/media\///'); do ls -l apps/web/.next/static/media/$f; done
  ```
- **Tests:**
  - `src/components/*.test.tsx`
  - `src/lib/*.test.ts`
  - `src/design/tokens.test.ts` (runs in the node environment)
  - `next/navigation` is mocked in `src/test/setup.ts`; `setPathname()` changes the current path

## Notables

- **JS weight.** About 185 KB gzip of JS loads on a page today, almost all of it the React/Next runtime (our components and next-intl are about 13 KB). That's above the PRD's 150 KB target for article pages. Measure again on the real article page and keep client components to a minimum.
- **Content Security Policy.** The inline theme script will need a hash or nonce once a CSP is added.
- **Placeholder brand.** The wordmark is `site.name` until a brand is decided.
- **Not checked in a real browser.** No browser or device testing was done: layout and dark mode are covered by markup tests and contrast maths. Check `/styleguide` on a phone (including the Facebook in-app browser).
- **Follow-ups:**
  - If Lighthouse (mobile, throttled) on the article page shows fonts delaying LCP: self-host one trimmed file per font (Basic Latin + Mongolian Cyrillic) via `next/font/local`, an estimated 75–85 KB in 2 files.
  - BreadcrumbList JSON-LD (needs a site URL env var)
  - article type labels on cards (analysis / opinion / sponsored, PRD §10.5; not in the API yet)
  - italic font files
  - a breaking-news banner component

## Key files

`apps/web/src/app/{globals.css,layout.tsx}`, `apps/web/src/components/`, `apps/web/src/lib/{theme,routes,media,pagination}.ts`, `apps/web/src/design/`, `apps/web/src/app/styleguide/`, `apps/web/messages/mn.json`, `apps/web/vitest.config.ts`, `apps/web/src/test/`.

---
Last updated: 2026-10-07 — only Source Serif 4 is preloaded (~103 KB); font size table; earlier: initial design system.
