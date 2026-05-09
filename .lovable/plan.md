## Goal

Reduce abuse risk from regions that aren't part of your real audience (starting with China) without hard-blocking anyone. We apply a much stricter per-IP rate limit on the costly endpoints when the request originates from a "strict" country, while keeping the user-facing behavior identical to existing rate limiting (progressive delay — no new error, no block).

## Scope

Apply tiered limits to the costly endpoints only. Cache reads, page loads, and `proxy-image` remain untouched.

- `generate-numberblock` (OpenAI + dispatches compose)
- `generate-gemini-numberblock` (Gemini)
- `scrape-numberblocks` (Firecrawl quota)

`compose-numberblock` is cheap (no third-party paid API) and is already gated behind `generate-numberblock`, so we leave it as-is.

## Country detection

Read country from request headers in this order, fall back to "unknown":
- `cf-ipcountry`
- `x-country-code`
- `x-vercel-ip-country`

Unknown country → treated as default tier (no false positives).

## Tiered rate limits

Configurable constants in each function. Starting values:

```text
STRICT_COUNTRIES = ["CN"]

AI generation (generate-numberblock + generate-gemini-numberblock):
  default tier:  perIp 10 / 10min   (unchanged)
  strict tier:   perIp 1  / 10min
  global:        50 / 10min          (unchanged, shared)

Scraping (scrape-numberblocks):
  default tier:  perIp 20 / 5min    (unchanged)
  strict tier:   perIp 1  / 5min
  global:        100 / 1min          (unchanged)
```

Behavior reuses the existing progressive-delay mechanism — once a strict-tier IP exceeds the threshold, the same `delayPerExcess` math applies and the response is delivered after the delay (capped at `maxDelay`). From the client's perspective it looks identical to a normal user hitting the standard limit; no new error code, no region message.

## Implementation steps

1. In `generate-numberblock/index.ts`: 
   - Add `getCountry(req)` helper alongside `getClientIP`.
   - Add `STRICT_COUNTRIES` constant and a `getPerIpThreshold(country)` helper that returns `1` for strict, `10` otherwise.
   - In `checkAIRateLimits`, accept the country (or threshold) and use it in place of the hard-coded `AI_RATE_LIMITS.perIp.threshold` for the IP check. Global stays the same.
2. Mirror the same change in `generate-gemini-numberblock/index.ts` (it already shares the `generate-numberblock` endpoint key in `rate_limit_log`, so the budget remains unified).
3. In `scrape-numberblocks/index.ts`: same pattern with its own `STRICT_COUNTRIES` and `perIp` strict value of `1`.
4. Deploy the three functions.
5. Verify with `curl_edge_functions`:
   - Call `generate-numberblock` twice with `cf-ipcountry: CN` for the same fake IP (use `x-forwarded-for`) → second call should be delayed.
   - Call it 5× with `cf-ipcountry: US` → no delay yet (well under 10).
   - Repeat for the Gemini and scrape functions.
6. Update `docs/CHANGELOG.md` with a one-liner.

## Out of scope

- No DB migration (existing `rate_limit_log` row shape works as-is).
- No frontend changes.
- No new error responses or UI messages.
- No blocking — strict-tier callers can still get through, just throttled aggressively.

## Easy future tweaks

- Add more countries: append to `STRICT_COUNTRIES`.
- Make stricter or looser: change the strict-tier threshold constant.
- Promote to a tiny `_shared/geo.ts` if we want to dedupe across functions later.

Ready to switch to build mode whenever you approve.
