# Mobile app (`apps/mobile`)

## Overview

**Scaffold.** Expo (SDK 57) + Expo Router. One screen calls `GET /health/ready` and shows the status in Mongolian. Feed, article, profile, push notifications and bookmarks are not built yet (PRD P1).

## How it works

- `main` is `expo-router/entry`; screens live in `app/` (`_layout.tsx` → Stack, `index.tsx`).
- `src/api.ts` creates the shared client from `EXPO_PUBLIC_API_URL`.
- i18next with `src/locales/mn.json`.
- Article bodies should later be rendered natively from `bodyJson` (the shared content schema), not in a WebView.

## Tech used

Expo SDK 57, Expo Router 57, React 19.2 / React Native 0.86 (pinned by the SDK), i18next, `@news/shared`.

## How to start

```bash
pnpm -F @news/mobile dev                 # Metro on :8081; press i (iOS sim) / a (Android) or scan with Expo Go
pnpm -F @news/mobile exec expo login     # any Expo CLI command goes through `exec`
```

On a physical device set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine's LAN IP (e.g. `http://192.168.1.20:4000`).

## How to maintain

- Add native modules with `pnpm -F @news/mobile exec expo install <pkg>` so versions match the SDK; after SDK changes run `… exec expo install --fix`.
- UI strings in `src/locales/mn.json`.

## Notables

- `pnpm expo …` at the repo root fails — the Expo CLI is only installed in this package.
- `react-native-worklets` (0.10.1) and `react-native-reanimated` (4.5.1) are pinned to SDK 57's versions, and `@react-native/metro-config` is overridden to 0.86.3 in `pnpm-workspace.yaml`, because pnpm auto-installed newer, incompatible peers.
- Some Expo package ranges were loosened (`~57.0.0`) to respect pnpm's release-age guard; `expo install --fix` can tighten them once the newest patches are a day old.
- `build` runs `expo export` (web/iOS/Android bundles), not a store build; EAS is not configured yet.

## Key files

`app/_layout.tsx`, `app/index.tsx`, `src/api.ts`, `src/i18n.ts`, `src/locales/mn.json`, `app.json`.

---
Last updated: 2026-10-07 — initial version.
