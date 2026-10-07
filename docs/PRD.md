# PRD: Mongolian Political News & Officials Database

**Version:** 0.1 (draft) · **Date:** 2026-10-07 · **Owner:** solo developer · **Working name:** TBD

---

## 1. Summary

This is a Mongolian-language political news site and mobile app. Articles sit on top of a structured database of public officials. Every member of the State Great Khural (УИХ, 126 seats), every cabinet member, agency heads and recognised political experts get a **living profile**: positions over time, party, constituency, committees, bills, votes, asset declarations, statements, promises, and every article that tags them.

The edge over competitors such as vip76.mn is **data depth plus provenance**: every fact on a profile links to a source.

---

## 2. Goals and non-goals

### Goals
1. **Become the reference for "who is this official and what have they done".** Profiles should rank on Google for searches like `<name>`, `<name> хөрөнгө` and `<name> УИХ`.
2. **Publish political news fast and reliably**, including during breaking-news traffic spikes from Facebook.
3. **Every factual claim is traceable** to a primary source. This is a credibility moat and a legal shield.
4. **The solo developer can run it.** Minimal moving parts, one VPS, the CDN does the heavy lifting.

### Success metrics (first 6 months after launch)
| Metric | Target |
|---|---|
| Profiles complete (MPs + cabinet, P0 fields, all sourced) | 100% |
| Profile data freshness (time from change to update) | < 72 h |
| Publish → live on web (CDN purged) | < 30 s |
| Organic search share of traffic | ≥ 25% |
| Uptime during spikes | no origin outage from traffic alone |
| Corrections published within | 24 h of verification |

### Non-goals (for now)
- User accounts, comments, forums or reader UGC.
- A paywall or subscriptions.
- Self-hosted video.
- Real-time collaborative editing.
- An automated (unreviewed) data pipeline. Scraped data never auto-publishes.
- AI-written articles.

---

## 3. Target users

| Segment | Need | Primary surface |
|---|---|---|
| **General readers** (Facebook-driven, mobile, UB and aimags) | Fast political news; "who is this person?" | Mobile web via FB in-app browser, later the app |
| **Engaged citizens and voters** | Track their constituency MPs, promises, votes, assets | Profile pages, constituency pages |
| **Journalists and researchers** | Reliable sourced data, history of positions and declarations | Profiles, search, source links |
| **NGOs and watchdogs** | Asset declarations, voting records, promise tracking | Profiles, (later) data exports |
| **Officials and their staff** | Monitor coverage; request corrections or a reply | Profile pages, right-of-reply form |
| **Internal: reporters, editors, data editors** | Fast authoring, safe publishing, easy data upkeep | Admin app |

---

## 4. Scope: MVP vs later

Priority key: **P0** = MVP launch blocker · **P1** = next, after launch · **P2** = later or maybe never.

### MVP (P0): web + admin + API only
- Newsroom admin: auth, roles, Tiptap editor, media library, revisions, scheduling, homepage layout.
- Public web (Next.js): home, articles, sections, tags, search, people directory, profiles, parliament, parties, constituencies, committees, cabinet, corrections log, policy pages, right-of-reply form.
- **Profile data commitment: 126 MPs and the current cabinet only.** The data model supports every person type from day one, but data entry is limited to these groups.
- Profile fields: identity, photo, bio, party history, constituency, committee seats, positions over time, asset declarations (summary figures + archived source), curated statements, tagged articles.
- Search with Cyrillic and Latin transliteration.
- SEO, Facebook OG previews, sitemaps, Google News sitemap, RSS.
- CDN caching and on-publish purge so the site survives spikes.

### Later
- **P1:** Expo app (read-only feed, profiles, search, breaking push). Bills sponsored (manually, for notable bills). Promise tracker (pilot with about 30 high-profile promises). Agency-head and expert profiles. "Most read". Public "report an error" button per data block. Scheduled pin expiry on the homepage. Data change review (second-person approval).
- **P2:** Per-MP roll-call votes. English UI and content. Election results history. Assisted scrapers (parliament.mn, the IAAC declaration portal, legalinfo.mn) feeding a review queue. Live blogs. MP comparison. Data exports and API for researchers. Newsletter. Real-time co-editing. Mongolian spellcheck.

### Why the app is not MVP
Web carries SEO and Facebook traffic, which is where the audience starts. The app only pays off once there is an audience to push to. Building three clients at once is the main risk to a solo launch. Because the API and OpenAPI contract are built first, the app becomes a thin client later.

### Why votes are P2
Per-member roll-call data has to come from a reliable machine-readable source. Availability on parliament.mn needs verifying. Entering it by hand for 126 MPs does not scale for one person. The model is designed now so votes slot in later.

---

## 5. Feature list

### 5.1 Public content
| ID | Feature | Pri |
|---|---|---|
| C1 | Article page: headline, lead, body, hero image with credit, byline(s), published/updated timestamps, article type label (news / analysis / opinion / interview / explainer / sponsored), tagged people with mini-cards, sources list, correction notes | P0 |
| C2 | Home page with editor-controlled layout and a breaking-news banner | P0 |
| C3 | Section/category pages and tag/topic pages (paginated) | P0 |
| C4 | Author pages | P0 |
| C5 | Related articles (same people/tags) | P0 |
| C6 | Share buttons (Facebook, Messenger, copy link) | P0 |
| C7 | "Most read" (Redis counters, flushed to PG) | P1 |
| C8 | Live blog | P2 |
| C9 | Ad slots (fixed sizes, no layout shift) | P1 |

### 5.2 Profiles and political data
| ID | Feature | Pri |
|---|---|---|
| D1 | Person profile: overview, current role(s), party, constituency, committees, contacts/socials (official only) | P0 |
| D2 | Positions timeline (any role, any org, with start/end and source) | P0 |
| D3 | Party membership history | P0 |
| D4 | Asset declarations by year: key figures, year-over-year delta, archived source document | P0 |
| D5 | Statements/quotes: curated, dated, primary source link (video timestamp where possible) | P0 |
| D6 | Tagged articles feed on the profile | P0 |
| D7 | Directory with filters (party, constituency, committee, role, term) | P0 |
| D8 | Parliament overview: seat chart by party, leadership, caucuses (бүлэг), committees | P0 |
| D9 | Party, constituency, committee and cabinet pages | P0 |
| D10 | "Last verified" date per data block and per profile | P0 |
| D11 | Bills sponsored, plus bill pages with status history | P1 |
| D12 | Promise tracker (status + dated evidence) | P1 |
| D13 | Agency heads and experts | P1 |
| D14 | "Report an error" on each data block | P1 |
| D15 | Roll-call votes per MP, plus vote event pages | P2 |
| D16 | Election history and results | P2 |
| D17 | Compare two MPs | P2 |

### 5.3 Search
| ID | Feature | Pri |
|---|---|---|
| S1 | Unified search across articles, people, organisations | P0 |
| S2 | Latin-typed Mongolian → Cyrillic matching (transliteration) | P0 |
| S3 | People autocomplete (header search, admin tagging) | P0 |
| S4 | Filters: type, date range, section | P1 |

**Transliteration approach for P0 (Postgres only, no extra service):**
- Store a `search_skeleton` column for each searchable name or title. Build it by transliterating Cyrillic to Latin and then normalising it to a **lossy skeleton**. Apply the same normalisation to the query.
  - Lowercase; strip punctuation and hyphens.
  - Common Latin variants: `kh→h`, `ts→c`, `zh→j`, `q→o` (ө), `v→u` (ү in chat Latin), `w→u`, `ye→e`, `yo→e`.
  - Mongolian letters: `ө→o`, `ү→u`, `ы/й→i`.
  - Collapse doubled vowels (`aa→a`, `uu→u`).
- Match with `pg_trgm` similarity on the skeleton, plus a `simple`-config tsvector for Cyrillic full text. Postgres has no Mongolian stemmer.
- Add a `person_alias` table for English-press spellings, nicknames and old names. Example: `Oyun-Erdene`, `Oyuun-Erdene` and `Оюун-Эрдэнэ` all produce the skeleton `oyunerdene`.
- Keep a golden test set of about 200 real queries in CI.
- Move to Meilisearch/Typesense only if Postgres quality or latency fails (P2).

### 5.4 Distribution
| ID | Feature | Pri |
|---|---|---|
| X1 | OG/Twitter meta; generated share cards for profiles | P0 |
| X2 | XML sitemaps, Google News sitemap (last 48 h), RSS per section | P0 |
| X3 | Facebook re-scrape on publish or update | P0 |
| X4 | Push notifications (app) for breaking news and followed people | P1 |
| X5 | Follow a person (app, local + push topic) | P1 |
| X6 | Newsletter | P2 |

### 5.5 Mobile app (Expo), all P1
- Read-only and anonymous. Shares the API contract via a client generated from OpenAPI.
- Push via Expo Push. Deep links (`/news/:id`, `/person/:slug`). OTA updates via EAS Update.
- Offline cache of the last feed and opened articles.
- Bookmarks stored locally.

---

## 6. Data entities and relations

**Conventions:**
- Every table has `id`, `created_at`, `updated_at`.
- Translatable display fields use `*_mn` (required) and `*_en` (nullable) for names and short labels. Articles use `locale` + `translation_group_id`.
- Every factual record that carries provenance has a `source_id`.

### 6.1 Core political entities
| Entity | Key fields | Relations |
|---|---|---|
| **person** | slug, `ovog` (patronymic), `ner` (given name), `urgiin_ovog` (clan, opt.), display name (e.g. "Л.Нэр"), latin name, gender, birth year (public only), photo_media_id, bio, kind flags (mp, minister, official, expert), socials, last_verified_at | has many position, alias, declaration, statement, promise; m:n article |
| **person_alias** | alias, script (cyrl/latn), kind (spelling, nickname, former name), search_skeleton | → person |
| **organization** | type (parliament, party, caucus, committee, subcommittee, government, ministry, agency, court, ngo, company, media), name, short name, color (parties), logo, parent_id | self-tree; has many position |
| **term** | body (parliament / cabinet), number (e.g. 9th УИХ 2024–2028; cabinet number), start, end | has many constituency, position, bill |
| **constituency** | term_id, number, name, type (majoritarian / party-list), seats, areas (aimag/düüreg list) | → term; has many position |
| **position** | person_id, organization_id, role (member, chair, deputy chair, minister, head, secretary-general, caucus leader…), term_id?, constituency_id?, start_date, end_date, end_reason, source_id | → person, organization, term, constituency, source. **One table covers MP seats, party membership, committee seats, ministries and agency posts.** |
| **asset_declaration** | person_id, year, filed_date, key figures (income, assets, liabilities, real estate count, vehicles count) as columns + `details jsonb`, notes, source_id, archived document media_id | → person, source, media |
| **statement** | person_id, quote, said_at, context, venue/medium, media timestamp, article_id?, source_id, verified_by | → person, source, article, user |
| **promise** (P1) | subject (person_id or organization_id), text, made_at, category, target date, current status, source_id | has many promise_update |
| **promise_update** (P1) | promise_id, status (not started / in progress / partially kept / kept / broken / stalled), date, note, source_id, editor_id | → promise, source |
| **bill** (P1) | title, registration no., term_id, initiator type (government / MPs / president), status, status history jsonb, submitted_at, official URL, document media_id | m:n person via bill_sponsor (role: initiator / co-sponsor) |
| **vote_event** (P2) | bill_id?, date, session, motion text, result, counts, source_id | has many vote_record |
| **vote_record** (P2) | vote_event_id, person_id, choice (yes / no / absent / did not vote) | → vote_event, person |
| **election / candidacy** (P2) | election type and date; candidacy: person, constituency, party, votes, elected | → person, constituency, organization |

### 6.2 Editorial entities
| Entity | Key fields | Relations |
|---|---|---|
| **article** | type, status (draft / in_review / scheduled / published / unpublished / archived), headline, social headline, SEO title, slug, lead, body_json (ProseMirror), body_text, category_id, hero_media_id, flags (breaking, exclusive, sponsored), publish_at, first_published_at, published_at, updated_at, locale, translation_group_id, canonical override, current_revision_id | → category, media; m:n person, tag, organization (P1), user (authors); has many revision, correction, article_source |
| **article_revision** | article_id, body_json + all meta snapshot, author_id, kind (autosave / save / publish / restore), created_at | → article, user |
| **article_person** | article_id, person_id, prominence (main / mentioned), origin (manual / @mention / suggestion-confirmed) | join |
| **article_source** | article_id, source_id, label | join |
| **category / tag** | slug, name_mn/en, (category) parent_id, order | m:n article |
| **source** | url, title, publisher, published_at, accessed_at, archive_url (Wayback), archived media_id | used by position, declaration, statement, promise_update, article_source, vote_event |
| **correction** | target (article_id or entity_type + entity_id), kind (correction / clarification / update), text, published_at, editor_id | → article or profile entity |
| **feedback** | kind (right_of_reply / error_report / tip), name, contact, target ref, body, attachments, status (received / reviewing / reply published / declined), due_at, decision note, handled_by, linked reply article/correction | → article/person, user |
| **media** | r2_key, kind (image / pdf / audio), mime, w, h, sha256, variants jsonb, blur placeholder, alt, caption, credit, license, focal point, uploaded_by | used by article, person, declaration, bill |
| **homepage_layout** | version, zones jsonb (slot → article_id or auto rule, pin expiry), status (draft / live / archived), published_by, published_at | refs article |
| **breaking_banner** | text, url, active_from, expires_at | |
| **redirect** | from_path, to_path, code | |
| **user** | email, password hash, totp secret, role, display name, author bio and photo, active, last_login | authors article; actor in audit_log |
| **audit_log** | actor_id, action, entity_type, entity_id, diff jsonb, ip, at | → user |
| **push_message / device** (P1) | message: article_id, title, audience, sent_at, stats; device: expo token, topics | |

### 6.3 Key relation notes
- A person's **current state is derived from `position`** where `end_date IS NULL`: current party, seat, committees and ministry. Do not denormalise it except into a materialised `person_summary` view that is refreshed on write.
- People can be an MP and a minister at once (Mongolia permits dual roles). These are simply two open positions.
- Constituencies are **per term**, because boundaries change between elections.
- Deleting is soft for person, article and source. Hard delete is admin-only and audited.

---

## 7. Web pages (Next.js App Router)

URLs use **Latin slugs plus a numeric id**. Cyrillic slugs turn into percent-encoded mush when shared on Facebook. The id is canonical; a slug change produces a redirect.

| Page | Route (proposed) | Rendering | Pri |
|---|---|---|---|
| Home | `/` | ISR + on-demand revalidate | P0 |
| Article | `/news/[id]-[slug]` | ISR, revalidate on publish/update | P0 |
| Section | `/section/[slug]` | ISR | P0 |
| Tag/topic | `/tag/[slug]` | ISR | P0 |
| Author | `/author/[slug]` | ISR | P0 |
| People directory | `/people?party=&constituency=&committee=&role=` | ISR + client filters | P0 |
| Person profile | `/person/[slug]` (sections: overview, positions, assets, statements, news; P1: bills, promises; P2: votes) | ISR, revalidate on data change | P0 |
| Parliament overview | `/parliament` (current term) and `/parliament/[term]` | ISR | P0 |
| Party | `/party/[slug]` | ISR | P0 |
| Constituency | `/constituency/[term]/[slug]` | ISR | P0 |
| Committee | `/committee/[slug]` | ISR | P0 |
| Cabinet | `/cabinet` (current) and `/cabinet/[number]` | ISR | P0 |
| Search | `/search?q=` | Dynamic, `noindex` | P0 |
| Corrections log | `/corrections` | ISR | P0 |
| Right of reply / contact | `/reply`, `/contact` | Static + form POST | P0 |
| Editorial policy, methodology, ownership & funding, about, privacy, terms | `/about/*` | Static | P0 |
| Feeds and sitemaps | `/rss/*`, `/sitemap*.xml`, `/news-sitemap.xml` | Route handlers, cached | P0 |
| 404 / 500 | — | Static | P0 |
| Bill | `/bill/[id]-[slug]` | ISR | P1 |
| Promise tracker | `/promises`, `/promise/[id]` | ISR | P1 |
| Agency / organisation | `/org/[slug]` | ISR | P1 |
| Experts directory | `/experts` | ISR | P1 |
| Vote event | `/vote/[id]` | ISR | P2 |
| Compare MPs | `/compare?a=&b=` | Dynamic | P2 |
| Elections | `/elections/[year]` | ISR | P2 |
| English mirror | `/en/...` | same | P2 |

---

## 8. App screens (Expo), all P1 unless noted

| Screen | Contents |
|---|---|
| Feed (Home) | Same layout zones as the web home, simplified; breaking banner |
| Sections | Section list, then a section feed |
| Article | Native renderer for ProseMirror JSON (no WebView); share; bookmark |
| Search | Unified search with transliteration; recent searches stored locally |
| People | Directory with filters |
| Person profile | Same sections as web, tabbed; follow toggle |
| Parliament | Seat chart, leadership, committees |
| Bookmarks | Stored locally |
| Notifications settings | Breaking on/off, followed people, quiet hours |
| Settings | Text size, theme, language (P2), about/policies, report a problem |
| Onboarding (P2) | Pick people/topics to follow |

---

## 9. Admin / newsroom requirements

The admin is a separate React + Vite SPA on its own subdomain (`admin.`). It talks only to authenticated `/admin/*` API routes.

### 9.1 Auth and security
- **Invite-only accounts.** There is no public sign-up.
- Email and password hashed with argon2id. **TOTP 2FA is mandatory for every role.**
- Server-side sessions in Redis, carried in an `httpOnly`, `Secure`, `SameSite=Strict` cookie. Idle timeout is 12 h; absolute lifetime is 7 days. Users can "log out everywhere".
- Login and reset endpoints are rate-limited (`@fastify/rate-limit` on Redis). Accounts lock after repeated failures.
- Password reset goes through a transactional email provider using single-use, short-TTL tokens.
- **Optional extra gate:** Cloudflare Access in front of `admin.` (free tier). Recommended, since this is a political target.
- **Audit log** for every write: who, what, when, diff, IP. Admins can view it.

### 9.2 Roles and permissions
| Capability | Admin | Editor | Reporter | Data editor |
|---|:-:|:-:|:-:|:-:|
| Create/edit own article drafts | ✓ | ✓ | ✓ | – |
| Edit others' articles | ✓ | ✓ | – | – |
| Submit for review | ✓ | ✓ | ✓ | – |
| Publish / schedule / unpublish | ✓ | ✓ | – | – |
| Edit homepage layout and breaking banner | ✓ | ✓ | – | – |
| Upload and edit media | ✓ | ✓ | ✓ | ✓ |
| Edit profile data (persons, positions, declarations, statements, promises) | ✓ | ✓ | – | ✓ |
| Publish corrections; handle right of reply | ✓ | ✓ | – | – |
| Manage users, roles, settings; view audit log | ✓ | – | – | – |
| Send push notifications (P1) | ✓ | ✓ | – | – |

Permissions are checked in API route hooks, not just hidden in the UI.

### 9.3 Article editing (Tiptap)
- **Source of truth is ProseMirror JSON.**
  - The API validates it against a Zod schema that whitelists node and mark types.
  - It is rendered to React on web and native components in the app. A sanitised HTML cache serves RSS.
- **Custom nodes:**
  - Image with caption and credit; gallery.
  - Embeds: Facebook post/video, YouTube, X; others via a whitelist.
  - Pull quote.
  - **Statement quote**, linked to a `statement` record.
  - **Person mention**: `@` autocomplete links to the profile and auto-adds an `article_person` tag.
  - Source citation, rendered as a footnote and added to the article's sources.
  - Document (PDF) card; info box; divider.
- **Paste cleanup** for Word, Google Docs and Facebook text: strip styles, keep structure.
- **Metadata panel:**
  - Headline, social headline, SEO title, lead, slug (auto-transliterated, editable).
  - Category, tags, people (with suggestions from the alias dictionary that the editor confirms), sources, authors, type, flags.
  - Hero image and OG image override.
- **Live counters and warnings:** headline and SEO title length, missing alt text, missing hero credit, no sources on a news article, opinion missing its label.
- **Previews:** web article, Facebook card and mobile, at a draft preview URL with a signed token.
- **Soft edit lock:** "X is editing" via a Redis key with a heartbeat. Editors can take over. No real-time co-editing (P2).

### 9.4 Revisions
- **Autosave** every 15 s to a draft revision. Autosaves are coalesced to one per 5 minutes in history.
- An explicit save, a publish and a restore each create a named revision.
- **Diff view** between any two revisions: block-level text diff plus metadata diff.
- **Restore** any revision. This creates a new revision; history is never rewritten.
- **Post-publication edits:**
  - Editors mark an edit as *minor* or *substantive*.
  - A substantive edit **requires a correction or update note**. The note appears on the article and in `/corrections`.
  - The public "Updated" timestamp changes only on substantive edits.

### 9.5 Workflow and scheduling
- **States:** draft → in_review → scheduled or published → unpublished or archived.
- **Scheduling:**
  - `publish_at` creates a BullMQ delayed job keyed by article id. Jobs are idempotent; rescheduling replaces the job.
  - A **cron sweep every minute** publishes any overdue scheduled items, in case Redis lost the job.
  - All times are shown in **Asia/Ulaanbaatar** and stored in UTC.
- **Publish pipeline** (BullMQ jobs, retried):
  1. Revalidate Next.js tags for the article, home, sections and tagged persons.
  2. Purge Cloudflare URLs.
  3. Trigger a Facebook Graph re-scrape.
  4. Update sitemaps and the search index.
  5. Send push if flagged (P1).
- **Unpublish** returns 410, or redirects if a replacement exists. Scheduled unpublish is P2.

### 9.6 Media library
- **Upload:**
  - The browser PUTs directly to R2 using a presigned URL.
  - A BullMQ worker then generates variants with sharp (WebP/AVIF at widths 320–1600), a blur placeholder and a 1200×630 OG crop. It reads dimensions and **strips EXIF (including GPS)**.
  - A sha256 hash catches duplicates.
- **Required metadata:** alt text, credit/source, license (own / agency / handout / CC / screenshot-fair-use). Caption and focal point (used for crops) are optional.
- **Library features:** search by text, uploader, date and type; usage list ("used in N articles"); replace the file while keeping the id; deleting is blocked while the media is in use.
- **Documents:** declarations, bill texts and source PDFs are **archived copies**, because sources disappear.
- **Video:** embeds only.
- **Serving:** variants go out through a custom R2 domain behind Cloudflare with immutable cache headers. A changed file gets a new key.

### 9.7 Homepage layout editing
- **Zones are defined in code:** breaking banner, hero, top stack (4), section rails, opinion rail, "people in the news" rail, P1 most-read.
- **Each slot is either a pinned article or an auto rule** (latest in section X, latest tagged person Y). An optional pin expiry falls back to auto (P1).
- **Editing:** drag-and-drop, with a **live preview** of the draft layout using real rendering.
- **Publishing:** publishing a layout makes a new version. Editors can revert to any version. Publishing triggers home revalidation and a purge.
- **Breaking banner:** text, link and expiry. Turning it on or off purges every page that shows it.
- Scheduled layouts are P2.

### 9.8 Profile data editing
- There are forms for person, alias, position, declaration, statement, organisation, term and constituency. Bill and promise forms come in P1.
- **A source is required** for position, declaration, statement and promise_update. The form can create a source inline and paste a URL, and the system automatically requests a Wayback snapshot.
- There is CSV import for the bulk seed (MP list, committee rosters). Imports show a dry-run diff before commit.
- Every change goes into the audit log. The profile's `last_verified_at` is bumped explicitly with a "verified" action.
- **P1:** a second-person approval queue for data changes.
- **P2:** scraper output enters the same review queue and is never auto-published.

### 9.9 Ops inside the admin
- Queue dashboard (bull-board, admin-only).
- Manual "re-scrape Facebook", "purge URL" and "rebuild sitemap" buttons.
- Right-of-reply and error-report inbox with due dates.

---

## 10. Editorial safeguards

1. **Source links everywhere.**
   - Every news article lists its sources.
   - Every profile data point (position, declaration, statement, promise status) has a `source_id`.
   - Source URLs are archived (Wayback snapshot plus an R2 copy for PDFs).
   - The UI shows a source icon next to every data block.
2. **Corrections log.**
   - A public `/corrections` page shows date, article or profile, what changed and why.
   - The correction note also appears inline at the top or bottom of the article.
   - A substantive post-publication edit cannot be saved without a note (see 9.4).
3. **Right of reply.**
   - A public form (`/reply`) and an email address. Requests enter the `feedback` inbox with an **internal SLA**: acknowledge within 24 h, decide within 72 h.
   - Possible outcomes: publish the reply as an appended statement or a separate article (linked both ways), issue a correction, or decline with a documented reason.
   - All requests and outcomes are retained.
4. **Pre-publication contact.** For allegations against a named person, a checkbox records "subject contacted for comment" with the date and response. Publishing an article tagged *allegation* without it shows a warning.
5. **Clear labelling** of article types: opinion, analysis, sponsored/paid. Sponsored content is visually distinct and never mixed into news rails without its label.
6. **Neutrality by design.**
   - Every person gets the same profile template and fields.
   - A public **methodology page** explains data sources, update cadence and promise-rating criteria.
   - An ownership and funding disclosure page.
7. **Data accuracy.**
   - A "last verified" date on profiles.
   - A "report an error" link (P1).
   - Ambiguous data is shown as "unverified" or left out, not guessed.
8. **Personal data restraint.**
   - Publish only data tied to the public role or published by law (e.g. official asset declarations).
   - No home addresses or private phone numbers.
   - No details of non-public family members beyond what the official declaration lawfully discloses and what is newsworthy.
9. **Statements.** Quotes must link a primary source (video with timestamp, transcript, official post). Paraphrases are not stored as quotes.
10. **No silent deletion.** Unpublished articles leave a 410 with a short note. Exceptions are legal orders and the safety of individuals, both documented.

---

## 11. Non-functional requirements

### 11.1 Performance targets
| Target | Value |
|---|---|
| Core Web Vitals (p75, mid-range Android, 4G, FB in-app browser) | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 |
| Article page JS (first load) | < 150 KB gzip; no client JS for article body rendering |
| API latency | p95 < 150 ms on cached reads, < 400 ms uncached |
| Publish → visible on web | < 30 s, including CDN purge |

**Fonts:** you **must verify the font has Ө ө Ү ү glyphs**, because many Latin/Cyrillic fonts lack them. Self-host, subset and use `font-display: swap`.

### 11.2 Breaking-news traffic spikes
**Principle:** anonymous traffic never reaches Postgres per request.

- **Cloudflare in front of everything.** HTML is cacheable at the edge with `s-maxage` (e.g. 60 s) plus `stale-while-revalidate` (10 min) and `stale-if-error` (24 h). The site stays readable if the VPS dies.
- **Next.js ISR plus on-demand `revalidateTag`.** The API caches hot reads in Redis with tag-based invalidation.
- **Nothing per-user in server HTML.** View counts go through a beacon to the API: a Redis `INCR`, batched into PG every minute.
- **Edge targets:** CDN hit ratio > 95% for anonymous HTML. The origin must sustain ≥ 200 uncached req/s; the CDN absorbs the rest.
- **Load test with k6 before launch:** a 10,000-concurrent-reader article spike plus a home refresh storm.
- **Breaking-news runbook:** publish, then auto-purge, then the FB scrape. Admin-side "purge" buttons cover the case where automation lags.

### 11.3 SEO
- Server-rendered HTML with full content; a canonical per page; `lang="mn"` (with `hreflang` once English exists).
- **JSON-LD:**
  - `NewsArticle` (headline, image, datePublished/Modified, author, publisher).
  - `Person` on profiles (name, alternateName from aliases, jobTitle, memberOf, sameAs for official links).
  - `BreadcrumbList` and `Organization`.
- XML sitemaps (split by type), a **Google News sitemap** (last 48 h) and RSS.
- **Profiles are evergreen SEO assets.** Use descriptive titles (`Л.Нэр — УИХ-ын гишүүн, МАН | Site`) and unique meta descriptions generated from data.
- Search pages are `noindex`. Paginated listings are canonical to themselves. Slug changes produce 301s from the `redirect` table.

### 11.4 Facebook link previews (critical: FB is the main traffic source)
- **Tags:** `og:title`, `og:description`, `og:image` (absolute https, 1200×630, JPEG < 1 MB), `og:image:width/height`, `og:type=article`, `article:published_time`, `og:locale=mn_MN`, `fb:app_id`.
- **The tags must be in the initial HTML.** They must not depend on client rendering.
- **Generated share cards** for profiles and for articles without a suitable image: photo + name + role + party colour via `next/og`, cached and immutable per content hash.
- **Allowlist `facebookexternalhit` and `Facebot`** in Cloudflare WAF and Bot Fight Mode. Blocked crawlers mean blank previews, which is a common failure.
- **Re-scrape on publish and on headline/image change** via the Graph API (`scrape=true`). Changed images get **new URLs**, because FB caches images aggressively.
- QA each template in the Sharing Debugger and the **FB in-app browser**, which is the main reading context.

### 11.5 Availability, backup, security
- **Uptime:** 99.5% monthly at the origin; the CDN's stale-if-error covers reads.
- **Postgres:** nightly base backup plus continuous WAL archiving (wal-g/pgBackRest) to **off-site object storage**. RPO is 15 min and RTO is 4 h. **Run a restore drill monthly.**
- **Infra as code:** `docker compose` plus a provisioning script, so the VPS can be rebuilt from zero in < 4 h with a documented runbook.
- **Security:**
  - Cloudflare WAF and DDoS protection; origin firewall allows only Cloudflare IPs.
  - CSP, HSTS, secrets via env (never in the repo), Renovate/Dependabot.
  - Public form endpoints are rate-limited and protected by Turnstile.
- **Observability:** pino JSON logs, Sentry or GlitchTip for API/web/app errors, uptime monitoring with alerts to phone, and BullMQ failed-job alerts.

### 11.6 Architecture constraints (stack-specific)
- **pnpm monorepo:** `apps/api`, `apps/admin`, `apps/web`, `apps/mobile`, `packages/schema` (Zod + Drizzle), `packages/content` (ProseMirror schema and renderers), `packages/translit`, `packages/api-client` (generated from OpenAPI).
- **API split:** `/v1/public/*` (cacheable, no auth) and `/v1/admin/*` (session auth). Public responses send `Cache-Control` and `ETag`.
- **Shared code:** the transliteration/skeleton function is one package used by the API, the admin slug generator and the tests.
- **i18n from day one:**
  - All UI strings sit in message catalogues (`next-intl` on web, `i18next` on admin/app). There are no hardcoded strings.
  - The DB carries `*_en` columns now.
  - Dates and numbers are formatted with the `mn-MN` locale and fall back gracefully.

### 11.7 Accessibility
- WCAG 2.1 AA basics: alt text required in the CMS, contrast, keyboard navigation and focus states.
- Party colours are never the only carrier of meaning.

---

## 12. Risks

| # | Risk | L | I | Mitigation |
|---|---|:-:|:-:|---|
| 1 | **Data burden.** Collecting and maintaining 126+ profiles is more work than building the software. | H | H | Strict P0 field list; CSV seed; "last verified" dates; P2 scrapers into a review queue; recruit a part-time data editor early |
| 2 | **No machine-readable source** for votes and bills (parliament.mn structure changes, PDFs only) | H | M | Votes deferred to P2; verify source availability before committing; archive everything |
| 3 | **Legal exposure.** Defamation and "false information" claims under Mongolian law; pressure for takedowns | M | H | Source and archive every claim; pre-publication contact; right of reply; corrections log; lawyer on retainer; legal review of the policy pages |
| 4 | **Election-period rules.** Presidential election 2027, parliamentary 2028. Media rules may restrict coverage and paid content during campaigns | M | H | Legal review of the election laws' media provisions well before the campaign; label all paid political content; neutrality rules in the methodology |
| 5 | **Attacks.** DDoS, admin account takeover, defacement (a political target) | M | H | Cloudflare WAF and DDoS; mandatory 2FA; Cloudflare Access on the admin; origin locked to CF IPs; off-site backups; audit log |
| 6 | **Bus factor and burnout** (solo) | H | H | Strict scope; app deferred; boring tech; runbooks; IaC; no custom infra where a managed free tier exists |
| 7 | **Single VPS failure** | M | M | CDN stale-if-error; WAL backups off-site; rebuild runbook; a second VPS later |
| 8 | **Facebook dependency.** Algorithm changes cut reach | H | M | SEO-first profiles; Google News; app push (P1); newsletter (P2) |
| 9 | **Perceived partisanship** damages trust | M | H | Identical templates for everyone; public methodology; ownership disclosure; balanced sourcing; corrections visible |
| 10 | **Data errors** on profiles hurt credibility, or get used against the site | M | H | Provenance on every record; "unverified" state; error reporting; second-person approval (P1) |
| 11 | **Transliteration search quality** is poor for real queries | M | M | Alias table; skeleton rules; golden query test set; analytics on zero-result searches |
| 12 | **Personal data protection** (Personal Data Protection Law, 2021) | M | M | Publish only role-related or legally public data; privacy policy; a takedown process for non-public people |
| 13 | **Photo copyright** claims | M | M | License field required; prefer official and own photos; credit always shown |
| 14 | **Scope creep across three clients** | H | M | P0 gate; OpenAPI-generated client; app reuses the web content model and renderer |

---

## 13. Open questions
1. Brand name and domain. Is the media outlet legally registered?
2. Who besides you has admin access at launch? This decides whether the review/approval flow (P1) moves to P0.
3. Monetisation at launch: ads, sponsorship, grants? This affects the ad slots (C9) and the sponsored-content workflow.
4. Does parliament.mn publish per-member roll-call results consistently enough to enable D15?
5. Policy on anonymous sources: allowed, and with what approval?

## 14. Suggested phasing
1. **Foundation:** monorepo, schema, API skeleton with OpenAPI, auth + 2FA, media pipeline, Tiptap editor, revisions.
2. **MVP:**
   - Public web (articles + profiles), search with transliteration, homepage layout, publish pipeline (revalidate, purge, FB scrape).
   - Seed MPs and cabinet with sources.
   - k6 load test, restore drill, legal review of policy pages.
   - Launch.
3. **P1:** Expo app + push, bills, promise pilot, agency heads and experts, most-read, error reports, data approval queue.
4. **P2:** votes, English, scrapers, live blog, elections, compare, exports.
