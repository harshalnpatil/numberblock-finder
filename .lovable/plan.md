# Making Numberblock Finder actually accurate

Goal: for any number a kid types, show a **full-color, show-accurate** Numberblock, fast, and never show something obviously wrong.

## What the audit found

The pipeline has five strategies but none of them is reliable, and nothing checks the result before it is cached and shown.

1. **Wiki scraping is a guessing game.** `scrape-numberblocks` fetches a Fandom page through Firecrawl and picks an image with regex heuristics: filename-token match, then infobox regex, then "first image on the Gallery page" (no number check at all), then a loose filename match the code itself labels "fan art territory". Numbers above 1000 build URLs from digits (`/wiki/5000`) instead of the real page title, so they mostly 404. A `shouldScrape` gate silently refuses to even try most numbers between 101 and 999.
2. **AI generation asks the model to count.** Both generators send a long prompt saying "EXACTLY N blocks, verify by counting". Image models cannot count reliably past ~10, and there is no verification pass — whatever comes back is cached and served.
3. **The models are old and the output is the wrong product.** OpenAI still calls `dall-e-3`; Gemini calls `gemini-2.5-flash-image` directly with a raw API key. Both prompts ask for **black-and-white line art**, so even a perfect generation does not look like the show.
4. **Compose is not a character.** It places the place-value images side by side (100 | 20 | 3) — three separate characters in a row, not one Numberblock.
5. **SVG is the only correct one, and it's the ugliest.** It guarantees the exact block count by construction, but renders flat rectangles and degrades above ~400.
6. **Provenance is encoded in filenames.** `ai-007.png`, `svg-007.svg`, `comp-007.svg`; the UI re-derives the badge by string-matching the storage path. There is no `source`/`quality` column, so nothing can be ranked, re-verified, or upgraded over time.

## The path forward

Three ideas, in priority order.

### 1. A curated library is the ground truth for 1–100

Stop scraping live for numbers the show actually has. Build a one-time, verified library of the canonical full-color art for 1–100, stored in the bucket and marked as `curated` in the database. Curated always wins, is served instantly, and costs nothing per search.

Building it: run the existing scraper offline in batch over 1–100, then run a **vision review pass** (a vision model checks "is this a single Numberblocks character, and does it show N blocks?") and flag anything that fails for manual replacement. This is an admin job in Advanced mode, not something a visitor triggers.

### 2. A show-accurate renderer replaces the flat SVG

Rewrite the deterministic renderer to look like the show instead of like a spreadsheet: correct per-number palette, 3D-ish cube faces with highlight and shadow edges, the show's eye/mouth style, simple limbs, and the Numberling above the head. It keeps the one property nothing else has — **the block count is always exactly right** — and becomes the safety net that is never wrong, only ever less pretty than official art.

### 3. AI becomes reference-conditioned and verified, not free-form

- Move both generators onto the Lovable AI gateway with current premium image models (quality-first, as chosen).
- **Condition on a reference image**: send the deterministic render of the same number *as an input image* and ask the model to repaint it in the show's style while preserving the exact block layout. This converts "count N cubes" (which models fail) into "restyle this arrangement" (which they do well).
- **Verify before caching**: a vision model checks the output for block count, single character, one face, and full color. On failure, retry once, then fall back to the deterministic render. Nothing unverified ever reaches a kid's screen.
- Prompts move to one shared module so the scraper fallback and the direct endpoints cannot drift apart.
- Compose is retired as a user-facing strategy; the renderer handles multi-digit properly.

### Resolution order for any number

```text
curated library  ->  verified wiki scrape  ->  reference-conditioned AI (verified)
                                           ->  deterministic render (always correct)
```

## Phasing

**Phase 1 — numbers 1 to 100 (this build)**
Curated library, show-accurate renderer, reference-conditioned + verified AI, provenance columns, resolution order above.

**Phase 2+ — added to `docs/product_backlog.md`, not built now**

| Range | Approach |
| --- | --- |
| 101–1000 | Drop the `shouldScrape` guess; resolve real wiki titles from the wiki's own page list, cache the number→title map. Renderer draws hundred-slabs plus remainder. |
| 1,001–10,000 | No per-cube drawing. Renderer switches to labelled place-value towers (thousand slabs, hundred slabs, tens, ones) that stay countable at a glance. |
| 10,000–1,000,000 | Show's own convention for giant numbers: a small number of large "mega-blocks" with a scale legend, plus the Numberling. |
| Beyond 1,000,000 | Symbolic single figure with magnitude naming (million, billion) — accuracy shifts from "count the cubes" to "name the magnitude correctly". |

Each tier is a renderer mode, so the guarantee "the picture is never lying about the number" holds all the way up.

## Technical detail

- **Schema**: add `source` (`curated | wiki | ai | render`), `model`, `verified_at`, `verification_score`, and `is_primary` to `numberblocks_cache`; backfill from the existing path prefixes and stop parsing filenames in the UI. Storage keeps the deterministic paths.
- **New shared module** `supabase/functions/_shared/`: number→word, palette, block layout, prompt builder, and the vision verifier — used by every function.
- **New function** `verify-numberblock`: takes an image URL plus the target number, returns `{ ok, blockCount, issues[] }` from a vision model via the Lovable AI gateway.
- **New function** `curate-numberblocks`: admin batch job over a range — scrape, verify, mark curated or flag.
- **Rewrites**: `generate-svg-numberblock` becomes the show-accurate renderer; `generate-numberblock` and `generate-gemini-numberblock` move to the Lovable AI gateway with reference-image input, shared prompt, and the verify-then-cache loop; `scrape-numberblocks` loses `shouldScrape` for 1–100, gains verification on the gallery/fallback paths, and delegates its AI fallback instead of duplicating prompts.
- **Frontend**: strategy list becomes Wiki / Render / AI / Compare; badges read the new `source` column; Compare shows the verification result per strategy so quality is visible.
- **Cost**: premium image models only run on a cache miss for a number with no curated or verified wiki art — the library absorbs the common traffic.
