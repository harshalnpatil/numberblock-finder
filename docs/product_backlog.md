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
| 2.1 | Cache provenance columns | P0 | S | Done | Add `source` (`wiki\|ai\|render\|compose`), `model`, `verified`, `verification_note`, `verified_at` to `numberblocks_cache`; backfill from existing storage-path prefixes. |
| 2.2 | `verify-numberblock` vision check | P0 | M | Done | Edge function: given an image URL + target number, a vision model answers "one Numberblocks character? how many blocks? correct number shown?" Returns verdict + note. |
| 2.3 | Verify on write | P0 | M | Done | Every scrape/generate path verifies before caching. Failed verification is not returned as the answer; the pipeline falls through to the next strategy. |
| 2.4 | UI badges read `source` | P0 | S | Backend done | Stop deriving provenance by string-matching storage paths; the API returns `source`/`verified` and the gallery renders from that. |
| 2.5 | Scraper: drop unsafe fallbacks | P0 | S | Done | Delete the "first image on the Gallery page" fallback and the loose fan-art token match. Require an exact number/word match or a real infobox position. |
| 2.6 | Scraper: try every number, cache negatives | P0 | M | Done | Remove `shouldScrape` guessing for 1–1000; record "wiki has no page" as a real result instead of a pre-emptive skip. |
| 2.7 | Scraper: resolve real page titles | P0 | M | Done | Use the wiki's own search/title API so `_(character)`, `_(number)` and word-form pages stop being constructed guesses. |
| 2.8 | SVG renderer v2 | P1 | L | Not started | Keep the exact-count guarantee, lose the spreadsheet look: 3D cube faces with highlight/shadow, show-style eyes and mouth, proper limbs, Numberling above the head, correct stacking for tens/hundreds. |
| 2.9 | Reference-conditioned AI generation | P1 | L | Not started | Send the deterministic render of the same number to the image model as an input image and ask for a clean coloring-page redraw preserving the block layout. Verify, retry once, fall back to the render. Uses the existing OpenAI/Gemini keys — no gateway migration. |
| 2.10 | Shared prompt module | P1 | S | Not started | One `_shared/` module for number→word, palette, block layout and prompt building so the scraper's fallback and the direct endpoints stop drifting. |
| 2.11 | Accuracy dashboard | P2 | M | Not started | Report over `verified` / `source` so the failure rate per strategy is measurable. |
| 2.12 | Retire compose | P2 | S | Not started | Digit-collage output is not a character; remove once reference-conditioned AI lands. |

### Large-number roadmap

| Range | Approach | Priority |
| --- | --- | --- |
| 101–1,000 | Real wiki title resolution from the wiki's page list; renderer draws hundred-slabs plus remainder. | P1 |
| 1,001–10,000 | Renderer switches to labelled place-value towers instead of per-cube drawing. | P2 |
| 10,001–1,000,000 | Mega-blocks with a scale legend, plus the Numberling. | P3 |
| Above 1,000,000 | Symbolic figure with magnitude naming; accuracy means "names the magnitude right". | P3 |

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
