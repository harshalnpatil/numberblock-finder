

# Plan: Fix Advanced Mode + Bottom Sheet UI

## Issues to Fix

1. **Auto description is wrong** — currently says "Wiki → Compose → DALL-E" but should NOT include programmatic SVG. The description is already correct ("Wiki → Compose → DALL-E"), so no change needed there. But the `auto` strategy in the edge function must be verified to not route through SVG.

2. **UI change** — Replace the current inline toggle + radio panel with a **gear icon button** that opens a **Drawer (bottom sheet)** containing all strategy options.

## Additional Strategy Options to Add

- **Compose Only** — Skip wiki scrape, go straight to the compose pipeline (overlay number on base template). Useful for quick deterministic results without full AI.

## Changes

### 1. `src/components/AdvancedModePanel.tsx` → Rewrite as Drawer

- Replace `Collapsible` + `Switch` with a small gear icon `Button` that opens a `Drawer` (from `vaul` / shadcn `drawer.tsx`).
- Inside the drawer: keep the same RadioGroup with strategies.
- Add a `compose` strategy option: "Compose Only — Number overlay on template, no AI."
- Update `auto` description to clearly say: "Wiki scrape → Compose → DALL-E fallback (no SVG)".

### 2. `src/lib/api/numberblocks.ts`

- Add `'compose'` to `GenerationStrategy` type.
- Route `compose` to `compose-numberblock` edge function.

### 3. `src/components/ScrapeControls.tsx`

- Replace `<AdvancedModePanel>` inline rendering with just the gear button + drawer trigger. The drawer is self-contained.

### 4. Edge function verification

- Confirm `scrape-numberblocks` `auto` path does NOT call `generate-svg-numberblock`. (It currently doesn't — it falls through to `generate-numberblock` which is DALL-E. No change needed.)

## Files

| File | Change |
|------|--------|
| `src/components/AdvancedModePanel.tsx` | Rewrite: gear icon → Drawer with radio options, add `compose` strategy |
| `src/lib/api/numberblocks.ts` | Add `compose` to `GenerationStrategy`, add routing |
| `src/components/ScrapeControls.tsx` | Minor: adjust how AdvancedModePanel is rendered |

