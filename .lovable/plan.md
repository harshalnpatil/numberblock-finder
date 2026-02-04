

# Smart Scraping Optimization Plan

## Overview

This plan implements intelligent Firecrawl API usage to avoid wasting credits on numbers that likely don't have wiki images, plus automatic AI generation for single-number searches when no wiki image exists.

---

## Current State

- **scrape-numberblocks**: Calls Firecrawl API for every number not in cache
- **generate-numberblock**: Only triggered manually via "Make with AI!" button
- **useNumberblocksScraper**: Processes all numbers identically regardless of likelihood of finding a wiki image

---

## Proposed Rules

```text
+------------------+---------------------------------------+-------------------+
| Number Range     | Scrape Strategy                       | Auto-Generate?    |
+------------------+---------------------------------------+-------------------+
| 1-100            | Always try Firecrawl                  | Only if single    |
+------------------+---------------------------------------+-------------------+
| 101-1000         | Only "special" numbers:               | Only if single    |
|                  |   - Multiples of 10, 25, 50           |                   |
|                  |   - Perfect squares                   |                   |
|                  |   - Powers of 2                       |                   |
|                  |   - Repeating digits (111, 222...)    |                   |
+------------------+---------------------------------------+-------------------+
| 1001+            | Only very special numbers:            | Only if single    |
|                  |   - Powers of 10 (1000, 10000...)     |                   |
|                  |   - Named magnitudes (million,        |                   |
|                  |     billion, etc.)                    |                   |
|                  |   - Already in catalog (cache check)  |                   |
+------------------+---------------------------------------+-------------------+
```

**Auto-generation triggers when:**
1. User searched for exactly 1 number (not a range)
2. Number is not in cache
3. Either: number is not worth scraping OR scraping returned no image

---

## Implementation

### 1. Backend: Add `shouldScrape()` Helper

Create a function in the edge function to determine if a number is worth scraping:

```typescript
function shouldScrape(num: number): boolean {
  // Rule A: Always try 1-100
  if (num <= 100) return true;
  
  // Rule B: 101-1000 - only special numbers
  if (num <= 1000) {
    // Multiples of 10, 25, 50
    if (num % 10 === 0) return true;
    if (num % 25 === 0) return true;
    if (num % 50 === 0) return true;
    
    // Perfect squares (121, 144, 169, 196, 225, 256, 289, 324, 361, 400...)
    const sqrt = Math.sqrt(num);
    if (Number.isInteger(sqrt)) return true;
    
    // Powers of 2 (128, 256, 512)
    if (isPowerOf2(num)) return true;
    
    // Repeating digits (111, 222, 333...)
    if (hasRepeatingDigits(num)) return true;
    
    return false;
  }
  
  // Rule C: Above 1000 - only very special
  // Powers of 10 (1000, 10000, 100000, 1000000...)
  if (isPowerOf10(num)) return true;
  
  // Named magnitudes that appear in educational material
  const namedMagnitudes = [
    1000, 10000, 100000, 1000000, 
    10000000, 100000000, 1000000000
  ];
  if (namedMagnitudes.includes(num)) return true;
  
  return false;
}
```

### 2. Backend: Accept Single-Number Mode Flag

Modify the edge function to accept a parameter indicating if this is a single-number search:

```typescript
// In request body parsing
const isSingleNumber = body.isSingleNumber ?? (startNumber === endNumber);
```

### 3. Backend: Smart Scrape Logic

Update the scraping loop to skip non-special numbers and return `skipScrape` flag:

```typescript
for (let num = startNumber; num <= endNumber; num++) {
  if (cachedMap.has(num)) {
    // Return from cache (existing logic)
  } else if (!shouldScrape(num)) {
    // Skip scraping, mark for potential AI generation
    results.push({
      number: num,
      imageUrl: null,
      pageUrl: `https://numberblocks.fandom.com/wiki/${numberToWord(num)}`,
      error: 'Not expected to have wiki image',
      skipScrape: true,
    });
  } else {
    numbersToScrape.push(num);
  }
}
```

### 4. Backend: Auto-Generate for Single Numbers

If single-number mode and no image found, automatically call the AI generation:

```typescript
// After scraping completes
if (isSingleNumber && results.length === 1) {
  const result = results[0];
  if (!result.imageUrl && !result.cached) {
    // Auto-generate with AI
    const generated = await generateWithAI(result.number, supabase);
    if (generated.success) {
      result.imageUrl = generated.imageUrl;
      result.aiGenerated = true;
      result.error = undefined;
    }
  }
}
```

### 5. Backend: Extract AI Generation to Shared Function

Move AI generation logic to a reusable function within the scrape function (or import from shared module):

```typescript
async function generateWithAI(
  number: number, 
  supabase: any
): Promise<{ success: boolean; imageUrl?: string; error?: string }>
```

### 6. Frontend: Pass Single-Number Flag

Update the API call to indicate single-number searches:

```typescript
// In numberblocksApi.scrapeImages
body: { 
  startNumber, 
  endNumber,
  isSingleNumber: startNumber === endNumber 
}
```

### 7. Response Enhancement

Add new fields to the response for transparency:

```typescript
interface NumberImage {
  number: number;
  imageUrl: string | null;
  pageUrl: string;
  cached?: boolean;
  error?: string;
  aiGenerated?: boolean;
  skipScrape?: boolean;  // New: indicates we didn't try Firecrawl
  autoGenerated?: boolean;  // New: indicates auto-AI (not manual click)
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/scrape-numberblocks/index.ts` | Add `shouldScrape()`, `isPowerOf2()`, `isPowerOf10()`, `hasRepeatingDigits()` helpers; add smart scraping logic; add auto-generation for single numbers |
| `src/lib/api/numberblocks.ts` | Update `scrapeImages` to pass `isSingleNumber` flag; add `skipScrape` to interface |
| `src/hooks/useNumberblocksScraper.ts` | No changes needed - already handles `aiGenerated` field |
| `src/components/ImageGallery.tsx` | Optional: distinguish auto-generated vs manual-generated |

---

## Edge Cases Handled

1. **Cached numbers above 1000**: Always returned from cache, no re-scraping
2. **Range searches (multiple numbers)**: No auto-generation (user can click "Make with AI!")
3. **Special numbers that fail to scrape**: Still auto-generate if single-number mode
4. **Rate limiting**: Fewer Firecrawl calls = less likely to hit limits

---

## API Credit Savings Estimate

| Scenario | Before | After |
|----------|--------|-------|
| Search 1-100 | 100 calls | 100 calls |
| Search 101-200 | 100 calls | ~25 calls (multiples of 10, squares, etc.) |
| Search 1-1000 | 1000 calls | ~180 calls |
| Search 1001-2000 | 1000 calls | 1 call (only 1000) |
| Search single #5000 | 1 call | 0 calls + auto AI |

---

## Technical Details

### Helper Functions

```typescript
function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function isPowerOf10(n: number): boolean {
  if (n < 10) return false;
  while (n >= 10) {
    if (n % 10 !== 0) return false;
    n = n / 10;
  }
  return n === 1;
}

function hasRepeatingDigits(n: number): boolean {
  const str = n.toString();
  if (str.length < 2) return false;
  return str.split('').every(c => c === str[0]);
}
```

### Special Numbers in 101-1000

- **Multiples of 10**: 110, 120, 130... (90 numbers)
- **Multiples of 25** (not 10): 125, 175, 225... (~18 numbers)  
- **Perfect squares**: 121, 144, 169, 196, 225, 256, 289, 324, 361, 400, 441, 484, 529, 576, 625, 676, 729, 784, 841, 900, 961 (~21 numbers, many overlap with multiples)
- **Powers of 2**: 128, 256, 512 (3 numbers)
- **Repeating digits**: 111, 222, 333, 444, 555, 666, 777, 888, 999 (9 numbers)

**Total unique special numbers in 101-1000**: ~110 out of 900 (88% reduction in API calls)

