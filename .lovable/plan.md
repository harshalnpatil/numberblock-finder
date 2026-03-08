

# Fix: Wiki Disambiguation Pages Breaking Scraping

## Root Cause

The `numberToWord()` function generates URLs like `/wiki/Eighteen`, but the Numberblocks wiki uses **disambiguation pages** for some numbers. When you visit `/wiki/Eighteen`, it lands on a disambiguation page (no character image), while the actual character page lives at `/wiki/Eighteen_(character)`.

Some numbers (like Five, Twenty) auto-redirect from the base name to the character page, but others (like Eighteen) show a disambiguation page instead. This is inconsistent across the wiki and we cannot predict which numbers have disambiguation pages.

## Fix

Update `scrapeAndCacheNumber()` in `supabase/functions/scrape-numberblocks/index.ts` to implement a **two-attempt strategy**:

1. **First attempt**: Scrape the current URL (`/wiki/Eighteen`) as-is
2. **If no image found**: Check if the HTML contains disambiguation markers (e.g., "may refer to", "disambiguation" in the page)
3. **If disambiguation detected**: Re-scrape using the `_(character)` suffix URL (`/wiki/Eighteen_(character)`)

This costs one extra Firecrawl call only when a disambiguation page is hit -- which is a small subset of numbers.

### Alternative considered
We could always try `_(character)` first, but that would break numbers where the character page IS the base page (no `_(character)` variant exists). The fallback approach is safer.

## Changes

| File | Change |
|------|--------|
| `supabase/functions/scrape-numberblocks/index.ts` | In `scrapeAndCacheNumber()`, after the first scrape, detect disambiguation pages and retry with `_(character)` suffix |

### Detection Logic
The disambiguation page HTML contains telltale signs: the text "may refer to" and links to `_(character)`. We check for these in the scraped HTML before retrying.

### Code Change (in `scrapeAndCacheNumber`, around line 628-631)
After `extractInfoboxImage` returns null, add:
```typescript
// If no image found, check if this is a disambiguation page
if (!originalImageUrl && isDisambiguationPage(html)) {
  // Retry with _(character) suffix
  const charPageUrl = `https://numberblocks.fandom.com/wiki/${encodeURIComponent(numberWord)}_(character)`;
  console.log(`Disambiguation page detected for ${num}, retrying: ${charPageUrl}`);
  
  const retryResponse = await fetch('https://api.firecrawl.dev/v1/scrape', { ... });
  const retryData = await retryResponse.json();
  const retryHtml = retryData.data?.html || '';
  originalImageUrl = extractInfoboxImage(retryHtml, num);
}
```

Add helper:
```typescript
function isDisambiguationPage(html: string): boolean {
  return html.includes('may refer to') || 
         html.includes('disambiguation') || 
         html.includes('Disambiguations');
}
```

