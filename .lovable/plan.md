

# Plan: Programmatic SVG Generator + Advanced Mode

## Overview

Add a deterministic SVG generator for Numberblocks characters and an "Advanced Mode" panel that lets an adult control the generation strategy per search. The default kid-friendly UI stays unchanged — SVG generation is off by default and only accessible through Advanced Mode.

## 1. Programmatic SVG Generator (New Edge Function)

**File: `supabase/functions/generate-svg-numberblock/index.ts`**

A new edge function that builds an SVG string programmatically with zero AI involvement:

- **Blocks**: Colored rectangles in a grid, following canonical Numberblocks arrangements (1-9 stacked, 10 as 2x5, 11-99 as tens-columns + ones, 100 as 10x10, etc.)
- **Colors**: Use the canonical color map already in `generate-numberblock` (red=1, orange=2, yellow=3, etc.). For multi-digit numbers, each place-value component uses its digit's color.
- **Face**: Simple SVG eyes + smile on the top block
- **Numberling**: The digit rendered above the block stack
- **Limbs**: Optional simple arms/legs as lines or rounded rects
- **Output**: Renders SVG to PNG using ImageScript (already used in `compose-numberblock`), uploads to storage as `svg-{paddedNum}.png`, caches in `numberblocks_cache`

The function accepts `{ number }` and returns `{ success, imageUrl }`.

No config.toml JWT changes needed (will set `verify_jwt = false` like the others).

## 2. Gemini Image Generation (New Edge Function)

**File: `supabase/functions/generate-gemini-numberblock/index.ts`**

Uses the Lovable AI gateway (`google/gemini-2.5-flash-image`) with the same structural prompt from `generate-numberblock` but via `https://ai.gateway.lovable.dev/v1/chat/completions` with `modalities: ["image", "text"]`. Extracts the base64 image from the response, uploads to storage as `gem-{paddedNum}.png`.

`LOVABLE_API_KEY` is already available as a secret — no user action needed.

## 3. Generation Strategy Type

**File: `src/lib/api/numberblocks.ts`**

Add a type and extend API methods:

```typescript
export type GenerationStrategy = 
  | 'auto'           // Default: scrape → compose → DALL-E (current behavior, no SVG)
  | 'svg'            // Programmatic SVG only
  | 'ai-openai'      // OpenAI DALL-E only  
  | 'ai-gemini'      // Gemini image gen only
  | 'wiki-only';     // Scrape only, no fallback

// Add new API methods:
numberblocksApi.generateSVG(number)
numberblocksApi.generateWithGemini(number)
```

The `scrapeImages` call gets an optional `strategy` parameter. The `scrape-numberblocks` edge function will accept a `strategy` field:
- `auto`: Current behavior (unchanged)
- `svg`: Skip scrape, call `generate-svg-numberblock` directly
- `ai-openai`: Skip scrape, call `generate-numberblock` directly (skip composition)
- `ai-gemini`: Skip scrape, call `generate-gemini-numberblock` directly
- `wiki-only`: Scrape only, if no wiki image found return null (no AI fallback)

## 4. Advanced Mode UI

**File: `src/components/AdvancedModePanel.tsx`** (new)

A collapsible panel below the search controls, gated behind a toggle. Hidden by default to keep the kid-friendly experience clean.

```text
┌─────────────────────────────────────────┐
│ 🔧 Advanced Mode               [toggle]│
├─────────────────────────────────────────┤
│ Generation Strategy:                    │
│  ○ Auto (default)                       │
│  ○ Programmatic SVG (deterministic)     │
│  ○ AI - OpenAI (DALL-E 3)              │
│  ○ AI - Gemini                          │
│  ○ Wiki Only (no AI fallback)           │
└─────────────────────────────────────────┘
```

Uses radio buttons (RadioGroup from shadcn). The selected strategy is passed through to `scrapeImages` / `generateWithAI` calls.

## 5. Hook Changes

**File: `src/hooks/useNumberblocksScraper.ts`**

- `scrapeImages` signature becomes `(start, end, strategy?)` — defaults to `'auto'`
- Pass strategy to API calls
- Strategy flows through to the edge function

## 6. ScrapeControls Changes

**File: `src/components/ScrapeControls.tsx`**

- Accept `strategy` state from parent
- Render `<AdvancedModePanel>` inside the controls card
- Pass strategy to `onScrape(start, end, strategy)`

## 7. Wire-up in Index.tsx

- Hold `strategy` state in Index, pass down to ScrapeControls, pass to scrapeImages

## Files Summary

| File | Action |
|------|--------|
| `supabase/functions/generate-svg-numberblock/index.ts` | Create — programmatic SVG generator |
| `supabase/functions/generate-gemini-numberblock/index.ts` | Create — Gemini image generation |
| `supabase/functions/scrape-numberblocks/index.ts` | Modify — accept `strategy` param, route accordingly |
| `supabase/config.toml` | Add new function entries with `verify_jwt = false` |
| `src/lib/api/numberblocks.ts` | Add strategy type, new API methods |
| `src/components/AdvancedModePanel.tsx` | Create — advanced settings UI |
| `src/components/ScrapeControls.tsx` | Add advanced mode toggle + panel |
| `src/hooks/useNumberblocksScraper.ts` | Accept strategy param |
| `src/pages/Index.tsx` | Hold strategy state, wire through |

