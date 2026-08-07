# Changelog

All notable changes to **Numberblock Finder** are recorded here. Items that were tracked in [`product_backlog.md`](./product_backlog.md) and are **done** live here instead of the backlog.

The format is loosely inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## 2026-08-07

### Fixes

- **OpenAI image generation restored:** `dall-e-3` was retired upstream and the request also sent an unsupported `response_format` parameter, so every OpenAI generation returned 500. Both `generate-numberblock` and `scrape-numberblocks` now call `gpt-image-1-mini` without `response_format`, and accept either `b64_json` or a hosted `url` in the response.
- **Stop button cancels Compare All:** `compareStrategies` now registers an `AbortController` that `stopScraping` triggers, so the Stop button immediately clears the spinners, marks pending strategies as "Stopped", and releases the loading state instead of waiting for all five requests.

---

## 2026-05-09


### Abuse mitigation

- **Geo-tiered rate limits:** AI generation (`generate-numberblock`, `generate-gemini-numberblock`) and `scrape-numberblocks` now apply a stricter per-IP threshold (1 request per window) for requests from countries in a `STRICT_COUNTRIES` set (currently `CN`), reusing the existing progressive-delay mechanism. Default-tier limits, global limits, and user-facing behavior are unchanged.

---

## 2026-03-28

### Hygiene (Phase 1 backlog)

- **Package name:** Renamed npm package from `vite_react_shadcn_ts` to `numberblock-finder` in `package.json`.
- **README:** Replaced Lovable placeholder content with project description, prerequisites, setup, `VITE_SUPABASE_*` env notes, scripts (including Playwright and coverage), and license pointer.
- **Dead assets:** Removed `src/App.css` (Vite boilerplate; never imported).
- **Notifications:** Single stack using **Sonner** only. `App.tsx` mounts the Sonner `Toaster`; `useNumberblocksScraper` and `ImageGallery` use `toast` / `toast.success` / `toast.error` from `sonner`. Removed Radix-based `toaster.tsx`, `toast.tsx`, and `hooks/use-toast.ts`; dropped dependency `@radix-ui/react-toast`.
- **E2E smoke:** Added Playwright (`playwright.config.ts`, `e2e/smoke.spec.ts`) and `npm run test:e2e`. The config starts Vite on port **5199** with `--strictPort` and `reuseExistingServer: false` so tests do not attach to another app on the default dev port.

### Testing & coverage

- **Vitest coverage:** `@vitest/coverage-v8`, `npm run test:coverage`, HTML report under `coverage/`.
- **Unit tests:** `cn` (`src/lib/utils.test.ts`), `numberblocksApi` with mocked Supabase (`src/lib/api/numberblocks.test.ts`), and `NotFound` page (`src/pages/NotFound.test.tsx`).

---

## Earlier

No changelog was kept before 2026-03-28; prior history is in git.
