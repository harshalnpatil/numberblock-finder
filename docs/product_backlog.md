# Product Backlog — Numberblock Finder

**App:** Numberblock Finder  
**Stack:** React + Vite + TypeScript + Supabase + shadcn-ui (Lovable-generated)  
**Goal:** Kid-friendly image gallery for finding Numberblocks character pictures using multiple search strategies.

**Completed work** is listed in [CHANGELOG.md](./CHANGELOG.md), not in this file.

---

## Legend

| Symbol | Meaning                           |
| ------ | --------------------------------- |
| **P0** | Must-have — blocks launch         |
| **P1** | Important — needed soon           |
| **P2** | Nice-to-have — future enhancement |
| **P3** | Low priority / Backlog            |
| **S**  | Small — ≤ 2 hours                 |
| **M**  | Medium — 2–6 hours                |
| **L**  | Large — 6+ hours                  |

---

## Phase 1: Hygiene

| #   | Task                                         | Priority | Effort | Status      | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------- | -------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.3 | Remove unused Radix UI / shadcn dependencies | P2       | M      | Not started | The original audit understated feature usage: `ImageGallery.tsx` imports `card`, `button`, and `popover` (and likely more over time). **Incremental approach:** (1) run `depcheck` / bundle analyzer to list truly unused packages; (2) delete only `src/components/ui/*` files with zero importers; (3) remove matching `@radix-ui/*` entries from `package.json` and verify `npm run build`. Removing all Radix packages in one shot risks breaking transitive shadcn imports. **Already removed (see changelog):** `@radix-ui/react-toast` as part of the Sonner migration. |

---

## Phase 2: Image Accuracy Program

**Goal:** every result is either verified correct or a deterministic render that cannot be wrong.
Colour rules: wiki scrape stays full colour; AI and compose stay black-and-white coloring-page; SVG render stays full colour.

**Resolution order:** cache (verified) → wiki scrape (verified, colour) → reference-conditioned AI (verified, B&W) → deterministic SVG render (always correct).

| #   | Task | Priority | Effort | Status | Details |
| --- | ---- | -------- | ------ | ------ | ------- |
| 2.4 | UI badges read `source` | P0 | S | In progress | Backend is complete. Stop deriving provenance by string-matching storage paths in the frontend; render the API's `source`/`verified` values instead. |
| 2.9 | Reference-conditioned AI generation | P1 | L | Not started | Send the deterministic render of the same number to the image model as an input image and ask for a clean coloring-page redraw preserving the block layout. Verify, retry once, fall back to the render. Uses the existing OpenAI/Gemini keys — no gateway migration. |
| 2.10 | Shared prompt module | P1 | S | Not started | One `_shared/` module for number→word, palette, block layout and prompt building so the scraper's fallback and the direct endpoints stop drifting. |
| 2.11 | Accuracy dashboard | P2 | M | Not started | Report over `verified` / `source` so the failure rate per strategy is measurable. |
| 2.12 | Retire compose | P2 | S | Not started | Digit-collage output is not a character; remove once reference-conditioned AI lands. |

### Large-number roadmap

| Range | Approach | Priority |
| --- | --- | --- |
| 1,001–10,000 | Renderer switches to labelled place-value towers instead of per-cube drawing. | P2 |
| 10,001–1,000,000 | Mega-blocks with a scale legend, plus the Numberling. | P3 |
| Above 1,000,000 | Symbolic figure with magnitude naming; accuracy means "names the magnitude right". | P3 |

---


## Bot Traffic Hardening

**Goal:** Reduce server costs and protect expensive AI-generation endpoints from bot and scraper traffic, based on rules from the PatronView bot-traffic article (Aug 2026).

**Context:** This app gets significant traffic from China and other regions with no real audience. Supabase Edge Functions call OpenAI and Gemini APIs (real cost per request). Existing protection: geo-tiered rate limits already throttle CN IPs to `strictThreshold: 0` on AI generation endpoints, and a `rate_limit_log` table tracks per-IP and global call counts with progressive delays. The `robots.txt` currently allows all crawlers.

**Source:** [99% of My Website Traffic Is Bots](https://patronview.com/news/99-percent-of-my-website-traffic-is-bots/) (PatronView, Aug 2026)

| #   | Task | Priority | Effort | Status | Details |
| --- | ---- | -------- | ------ | ------ | ------- |
| BT1 | Add SEO crawler blocks to robots.txt | P1 | S | Not started | Add `Disallow: /` rules for the 12 SEO crawlers from the article: SemrushBot, AhrefsBot, MJ12bot, DotBot, BLEXBot, Barkrowler, DataForSEOBot, SiteAuditBot, AhrefsSiteAudit, SplitSignalBot, ThinkBot, BrightBot. Keep Googlebot, Bingbot, Twitterbot, and facebookexternalhit allowed. These crawlers identify themselves honestly and most respect robots.txt. |
| BT2 | Add AI crawler blocks to robots.txt | P1 | S | Not started | Add `Disallow: /` for AI crawlers with bad crawl-to-referral ratios: Claude-SearchBot, Amzn-SearchBot, GPTBot, ClaudeBot, CCBot, Bytespider. Cloudflare's managed AI Crawl Control already blocks declared training bots at the edge, but robots.txt provides a second layer and documents intent. |
| BT3 | Add Vietnam to STRICT_COUNTRIES set | P1 | S | Not started | Extend the existing `STRICT_COUNTRIES` set in all Edge Functions (`generate-numberblock`, `generate-gemini-numberblock`, `scrape-numberblocks`) from `['CN']` to `['CN', 'VN']`. The article documents a copycat Vietnam wave after blocking China. This reuses the existing progressive-delay mechanism with no new code paths. |
| BT4 | Tighten CN/VN to full 403 on edge functions | P2 | S | Not started | Currently CN IPs get `strictThreshold: 0` (throttled to zero AI calls but still hit the function). Consider returning a direct 403 for CN/VN IPs on AI generation and scrape endpoints before any Supabase lookup, saving database reads and compute. Gate behind an env var so it can be toggled without redeploy. |
| BT5 | Add per-IP rate limit on frontend page loads | P2 | M | Not started | The existing rate limiting covers Edge Functions only. If a custom domain is added and proxied through Cloudflare, add a Cloudflare WAF rate limit rule: 30 extensionless path requests per 10 seconds per IP, Managed Challenge on exceed. If no custom domain, consider a lightweight Supabase Edge Function middleware that checks `cf-ipcountry` and `cf-connecting-ip` headers. |
| BT6 | Evaluate Cloudflare WAF for custom domain | P3 | M | Not started | If the app moves to a custom domain (not `*.lovable.app`), add Cloudflare to the DNS path and configure WAF rules: (1) Block CN/VN, (2) Block 12 SEO crawlers by user-agent, (3) Challenge non-NA continents, (4) Challenge empty user-agents, (5) Challenge datacenter ASNs. Lovable's `*.lovable.app` subdomains do not give WAF access. This is a 2-way door (reversible by removing the DNS proxy). |

---

## Cross-Project Observability & Debugging System

**Goal:** Give AI agents and developers real production debugging context across all side projects.

**Stack baseline:**

- Supabase: canonical event and debug case database
- Langfuse: AI traces and evals (only where AI exists)
- Playwright: synthetic screenshots and regression checks

**Sources of truth:**

- Supabase: product telemetry and unified debug cases
- Langfuse: AI traces and prompt failures

**Outcome:** Any failure can be inspected via one Supabase debug case record that links all evidence.

**Further thinking (2026-03):** This cross-project stack is **not** started in this repo. It depends on a shared Supabase schema and operational ownership (who triages `debug_cases`). **Suggested order:** (1) define a minimal `debug_cases` + `artifacts` schema in one Supabase project; (2) add a tiny client helper to log events from this web app only; (3) Langfuse where product asks for AI evals. Playwright in this repo is **local smoke only** until screenshot storage and CI scheduling exist (Phase 6 in the original vision).

### Phase 1 - Core Foundation (Supabase)

**Goal:** Create a single debugging pipeline used by every project.

#### Task 1 - Create Supabase Observability Schema

Create tables:

- `projects`
- `sessions`
- `workflow_runs`
- `issues`
- `feedback`
- `ai_traces`
- `debug_cases`
- `artifacts`

Example structure:

`projects`

- `id`
- `name`
- `platform_type` (`n8n | chrome_extension | web_app`)
- `repo_url`
- `created_at`

`workflow_runs`

- `id`
- `project_id`
- `execution_id`
- `platform`
- `status`
- `input_json`
- `output_json`
- `started_at`
- `ended_at`

`issues`

- `id`
- `project_id`
- `severity`
- `title`
- `description`
- `source` (`n8n | user_report | ai_eval`)
- `status`
- `created_at`

`debug_cases`

- `id`
- `project_id`
- `issue_id`
- `workflow_run_id`
- `screenshot_url`
- `ai_trace_id`
- `status`
- `created_at`

Acceptance criteria:

- One database can store failures from every project.

#### Task 2 - Standardize Event Logging Library

Create a small reusable helper used by:

- n8n
- Chrome extensions
- web apps
- local scripts

Example events:

- `workflow_run_started`
- `workflow_run_completed`
- `workflow_run_failed`
- `user_feedback`
- `ai_trace_failed`
- `feature_event`

Acceptance criteria:

- All projects send structured events to Supabase.

### Phase 6 - Synthetic Debug Evidence

**Goal:** Automatically detect UI breakage.

#### Task 13 - Playwright Visual Checks

Create daily test:

- open web app
- open extension popup
- take screenshot

Compare with baseline.

Acceptance criteria:

- Visual regressions detected automatically.

### Phase 7 - Debug Context Broker

**Goal:** Allow AI agents to debug from real evidence.

Create service or n8n workflow: `debug-broker`

Input:

- `debug_case_id`

Fetch:

- Supabase events
- screenshots
- Langfuse trace

Return:

- debug bundle JSON

Example:

```json
{
  "issue_summary": "",
  "workflow_inputs": {},
  "workflow_outputs": {},
  "screenshot": "",
  "ai_trace": "",
  "repro_steps": []
}
```

Acceptance criteria:

- AI agent can debug using one bundle.

### Operational Rules

All projects must:

- log events to Supabase
- create `debug_case` on failures

Debug cases are the primary object AI agents read.
