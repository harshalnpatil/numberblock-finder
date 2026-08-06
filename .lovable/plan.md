# Improving Numberblock Finder accuracy

Revised after your feedback: no curated dataset, cache + scrape stay the backbone, colour rules split by source, and the backlog gets written first.

## Answering your questions first

**Are the API keys exposed?** No. `OPENAI_API_KEY` and `GEMINI_API_KEY` are Edge Function secrets — they only exist inside the server-side functions, never in the browser bundle and never in a response. Using them is expected and fine. The one change worth making is routing those calls through the Lovable AI gateway (`LOVABLE_API_KEY`) instead of hitting `api.openai.com` and `generativelanguage.googleapis.com` directly. Not for security — for access to current image models (`dall-e-3` and `gemini-2.5-flash-image` are both a generation behind) without managing two vendor accounts. Your own keys can stay as a fallback.

**Why a curated dataset?** You're right, it's redundant. `numberblocks_cache` already *is* the library — every successful scrape is permanently stored and served from cache. The real problem is that the cache has no idea whether what it stored is correct, so one bad scrape is cached forever. So instead of pre-building a library, we make the cache trustworthy: verify at write time, record the verdict, and re-resolve anything that failed. The library then builds itself from real traffic.

**Colour rules (your call, adopted):**
- Wiki scrape -> full-colour official art, as-is.
- AI generation and compose -> black-and-white coloring-page style, as today.
- Deterministic SVG render -> stays full colour, since it uses the real per-number palette and costs nothing.

## What's actually broken

1. **The scraper picks images by guesswork.** Filename-token match, then infobox regex, then *"first image on the Gallery page"* with no number check at all, then a loose match the code itself labels "fan art territory". That last two are how you got a wrong image for 1.
2. **`shouldScrape` refuses to try.** Numbers 101–999 are only attempted if they're "special" (multiples of 10/25, squares, powers of 2). Everything else is marked `Not expected to have wiki image` without a single request. Above 1000 the URL is built from digits (`/wiki/5000`) instead of the page title, so it 404s.
3. **Nothing verifies anything.** The AI prompt literally says "VERIFICATION INSTRUCTION: after drawing, verify the count" — that's text to a model that cannot count. No code checks the result. Same for scraped images.
4. **The cache can't tell sources apart.** Provenance is encoded in filename prefixes (`ai-007.png`, `svg-007.svg`) and the UI re-derives badges by string-matching the path. No `source`, no `verified`, so nothing can be re-checked or upgraded.
5. **Compose isn't a character.** 123 becomes three separate images in a row.
6. **The SVG render is correct but ugly** — flat rectangles, and it degrades above ~400.

## Plan

### Step 0 — write the backlog first

Before any code, add the full phased breakdown below to `docs/product_backlog.md` as numbered, prioritised, estimated tasks in the existing table format, so the work survives being done in pieces.

### Step 1 — make the cache trustworthy (P0)

- Add `source` (`wiki | ai | render | compose`), `model`, `verified`, `verification_note`, `verified_at` to `numberblocks_cache`; backfill from the existing path prefixes; UI badges read the column instead of parsing filenames.
- New `verify-numberblock` function: given an image and a target number, a vision model answers "one Numberblocks character? how many blocks? correct number shown?". Called before anything is cached.
- A scrape that fails verification is not cached as the answer — it falls through to the next strategy.

### Step 2 — fix the scraper (P0)

- Delete the "first gallery image" fallback and the loose fan-art match; require a positive number match or infobox position, then verification.
- Remove `shouldScrape` gating for 1–100 (try every number), and treat "wiki has no page" as a real, cached negative result rather than a guess made up front.
- Resolve real page titles instead of constructing them, so `_(character)`, `_(number)` and word-form pages stop being coin flips.

### Step 3 — improve the SVG renderer (P1)

Keep the exact-count guarantee, lose the spreadsheet look: 3D cube faces with highlight/shadow edges, show-style eyes and mouth, proper limbs, Numberling above the head, and correct stacking for tens/hundreds. This becomes the never-wrong fallback.

### Step 4 — better AI generation (P1)

- Route through the Lovable AI gateway on current premium image models.
- **Reference-conditioned**: send the deterministic render of the same number as an input image and ask the model to redraw it as clean coloring-page line art, preserving the exact block layout. This replaces "count to 47" with "restyle this", which models actually do well.
- Verify the output, retry once, then fall back to the render. One shared prompt module so the scraper's fallback and the direct endpoints stop drifting apart.

### Resolution order

```text
cache (verified)  ->  wiki scrape (verified, full colour)
                  ->  reference-conditioned AI (verified, B&W)
                  ->  deterministic render (always correct)
```

### Backlog beyond this build

| Range | Approach |
| --- | --- |
| 101–1000 | Real wiki title resolution from the wiki's page list; renderer draws hundred-slabs plus remainder. |
| 1,001–10,000 | Renderer switches to labelled place-value towers instead of per-cube drawing. |
| 10,000–1,000,000 | Mega-blocks with a scale legend, plus the Numberling. |
| Above 1,000,000 | Symbolic figure with magnitude naming; accuracy becomes "names the magnitude right". |
| Ops | Retire compose; add an accuracy dashboard over `verified` so failure rate is measurable. |

## Technical notes

- New `supabase/functions/_shared/` module: number→word, palette, block layout, prompt builder, verifier client — replaces the two duplicated copies of the prompt and structure guide.
- Verification uses a vision chat model via the gateway; it runs on cache-miss writes only, so it does not add cost to cache hits.
- Migration adds columns with defaults and a backfill; no data loss, existing storage paths unchanged.
