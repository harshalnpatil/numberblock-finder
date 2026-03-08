

# Status: Gallery Page Reorder NOT Yet Implemented

The disambiguation retry (from the previous plan) is in place, but the approved "reorder image extraction" plan has not been implemented. Here is what needs to be done:

## Current flow (lines 628-658)
1. Scrape main page → `extractInfoboxImage` (all 3 priorities including fan art filename match)
2. If no image + disambiguation → retry `_(character)` page → same `extractInfoboxImage`
3. If still nothing → return null

## Required flow (per approved plan)
1. Scrape main page → `extractInfoboxImage` **priorities 1-2 only** (exact number match + infobox)
2. If no image + disambiguation → retry `_(character)` page → priorities 1-2 only
3. **If still no image → scrape Gallery subpage → extract first valid image**
4. If still no image → fall back to priority 3 (fan art filename match) on original HTML
5. If still nothing → return null

## Changes needed

**File: `supabase/functions/scrape-numberblocks/index.ts`**

1. **Split `extractInfoboxImage`** into two modes: one that only checks priorities 1-2 (infobox), and one that checks priority 3 (filename fallback). Could be done with a parameter like `skipFallback: boolean`.

2. **Add Gallery scrape step** in `scrapeAndCacheNumber` between the disambiguation retry and the "no image found" return. This scrapes `{pageUrl}/Gallery` via Firecrawl and extracts the first valid character image.

3. **Add fan art fallback** after Gallery fails — run `extractInfoboxImage` with priority 3 on the original HTML.

4. **Clean up stale cache** for number 18: delete from `numberblocks_cache` where number = 18, and remove `018.webp` from storage.

