

## Plan: Composite Image Generation + Regenerate Button

### Problem
AI-generated images for larger numbers (e.g., 123) have wrong block counts and inconsistent block sizes. DALL-E cannot reliably count. The solution is to **compose images deterministically** from smaller scraped/cached parts.

### Approach: Deterministic Composite Images

For number 123, decompose into place values: 100 + 20 + 3. Scrape/fetch cached images for each component, then stitch them together server-side into a single composite image using canvas rendering in an edge function.

### Implementation Steps

**Step 1: Add "Regenerate" button to ImageCard**
- Show a small refresh/regenerate button on cards that already have an image (currently only missing images show the "Make with AI" button)
- Clicking it re-invokes the generation flow for that number, replacing the cached image

**Step 2: Create `compose-numberblock` edge function**
New edge function that:
1. Decomposes a number into place-value components (e.g., 123 → [100, 20, 3])
2. For each component, checks `numberblocks_cache` for an existing image
3. If a component is missing, triggers a scrape for it (components are always "special" numbers like 100, 20, 3 which have wiki pages)
4. Downloads all component images from storage
5. Composites them side-by-side into a single image using Deno-compatible image library (e.g., `imagescript` or raw canvas)
6. Uploads the composite to storage and caches it
7. Returns the composite URL

**Step 3: Update generation flow to prefer composition over AI**
- In `scrape-numberblocks`, when auto-generating for a single number > 10: try composite first, fall back to DALL-E only if composition fails
- In `generate-numberblock` (manual "Make with AI"): same logic — compose first, AI second
- Add a `method` field to the response so the UI knows if it was composed vs AI-generated

**Step 4: Update `numberblocksApi` and UI**
- Add `regenerate` method to the API that calls the generation endpoint with a `force: true` flag to bypass cache
- Update `ImageCard` to show the regenerate button
- Add a "Composed" badge (like the existing "AI" badge) for composite images

### Decomposition Logic (in edge function)

```text
decomposeNumber(123):
  hundreds = 1 → component: 100
  tens = 2 → component: 20  
  ones = 3 → component: 3
  Result: [100, 20, 3]

decomposeNumber(45):
  tens = 4 → component: 40
  ones = 5 → component: 5
  Result: [40, 5]

decomposeNumber(7):
  Just use direct scrape/generate for single digits
```

### Composite Layout

```text
+-------+------+-----+
|       |      |     |
|  100  |  20  |  3  | ← side-by-side, scaled proportionally
|       |      |     |
+-------+------+-----+
         = 123
```

### Technical Details

- **Image library**: Use `imagescript` (Deno-compatible, no native deps) for compositing PNG images
- **Component caching**: Each component (100, 20, 3) gets cached individually, so future composites reuse them
- **Regenerate flow**: Deletes old cache entry, then re-runs composition or AI generation
- **Rate limiting**: Composite calls count toward the existing `generate-numberblock` rate limit pool since they may trigger scrapes
- **Storage naming**: Composite images stored as `comp-123.png` to distinguish from scraped (`123.png`) and AI (`ai-123.png`)

### Files to Create/Modify

| File | Change |
|------|--------|
| `supabase/functions/compose-numberblock/index.ts` | **New** — composite image generation edge function |
| `supabase/functions/generate-numberblock/index.ts` | Add composite-first logic before DALL-E fallback |
| `src/lib/api/numberblocks.ts` | Add `regenerate()` method |
| `src/components/ImageGallery.tsx` | Add regenerate button to ImageCard |

