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

## Cross-Project Observability & Debugging System

**Goal:** Give AI agents and developers real production debugging context across all side projects.

**Stack baseline:**

- Supabase: canonical event and debug case database
- Sentry: errors and technical observability across all platforms
- Microsoft Clarity: session replay for browser apps
- Langfuse: AI traces and evals (only where AI exists)
- Playwright: synthetic screenshots and regression checks

**Sources of truth:**

- Supabase: product telemetry and unified debug cases
- Sentry: technical failures
- Clarity: user session replay
- Langfuse: AI traces and prompt failures

**Outcome:** Any failure can be inspected via one Supabase debug case record that links all evidence.

**Further thinking (2026-03):** This cross-project stack is **not** started in this repo. It depends on a shared Supabase schema, optional Sentry, and operational ownership (who triages `debug_cases`). **Suggested order:** (1) define a minimal `debug_cases` + `artifacts` schema in one Supabase project; (2) add a tiny client helper to log events from this web app only; (3) add Sentry only if error volume justifies it; (4) Clarity/Langfuse where product asks for session replay or AI evals. Playwright in this repo is **local smoke only** until screenshot storage and CI scheduling exist (Phase 6 in the original vision).

### Phase 1 - Core Foundation (Supabase + Sentry)

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
- `source` (`sentry | n8n | user_report | ai_eval`)
- `status`
- `created_at`

`debug_cases`

- `id`
- `project_id`
- `issue_id`
- `workflow_run_id`
- `sentry_issue_url`
- `clarity_session_url`
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

#### Task 3 - Install Sentry Across All Projects

Platforms:

- web apps
- Chrome extensions
- Node scripts
- backend services

Configure:

- release version
- environment
- project tags

Acceptance criteria:

- Every runtime reports errors to one Sentry organization.

#### Task 4 - Link Sentry Issues to Supabase

Create webhook or worker that:

- receives Sentry issue events
- inserts `issues` row
- creates `debug_cases` record

Acceptance criteria:

- Every Sentry issue creates a debug case.

### Phase 3 - Browser Observability

**Goal:** Capture user behavior before bugs.

#### Task 7 - Add Microsoft Clarity to Web Apps

Add Clarity script to:

- Lovable apps
- personal web apps

Capture:

- session recordings
- heatmaps
- user click paths

Acceptance criteria:

- Each user session has replay available.

#### Task 8 - Link Clarity Sessions to Debug Cases

When bug is reported, store `clarity_session_url` inside `debug_cases`.

Acceptance criteria:

- Each bug can link to a session replay.

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
- Sentry issue
- Clarity session
- screenshots
- Langfuse trace

Return:

- debug bundle JSON

Example:

```json
{
  "issue_summary": "",
  "stack_trace": "",
  "workflow_inputs": {},
  "workflow_outputs": {},
  "session_replay": "",
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
- report errors to Sentry
- create `debug_case` on failures

Debug cases are the primary object AI agents read.
