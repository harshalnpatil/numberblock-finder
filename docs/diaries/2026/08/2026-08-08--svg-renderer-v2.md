# SVG renderer v2

## Goal

Complete step 3 of `.lovable/plan.md`: preserve deterministic exact counts while replacing the flat spreadsheet-style SVG with a recognizable Numberblocks-style character.

## Implementation

- Extracted the pure layout and SVG generation into `supabase/functions/generate-svg-numberblock/renderer.ts` so it can be tested without starting the Edge Function.
- Every unit remains a separately marked visible cube, now with highlight, front, and shadow faces.
- Tens use complete columns of ten plus a bottom-aligned ones column. Hundreds use separated 10x10 slabs plus the tens/ones remainder.
- Added a Numberling badge, expressive eyes and mouth, curved arms, hands, legs, and feet.
- The renderer now rejects values above 1,000 rather than silently drawing a capped, incorrect count. The future symbolic large-number renderer remains in the product backlog.
- Cached renderer writes identify the implementation as `svg-v2`.

## Verification

- Deno tests assert exact block counts across representative values from 1 through 1,000, place-value layout for 347, required character features, and rejection of unsupported values.
