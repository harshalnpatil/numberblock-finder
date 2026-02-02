

# Rate Limiting for Firecrawl API Protection

## Overview

This plan adds rate limiting to protect your Firecrawl API quota from abuse. Instead of blocking rate-limited users, the system will **slow them down** with artificial delays, making abuse impractical while still allowing legitimate users to get their results (just a bit slower).

## How It Works

When a user triggers a scrape that needs to call Firecrawl:

1. **Check cache first** - If all requested numbers are cached, no rate limit applies (free access to cached content)
2. **Check rate limits** - Before making Firecrawl calls:
   - **Global limit**: If too many Firecrawl calls happened recently across all users, add a delay
   - **Per-IP limit**: If this specific IP made too many calls recently, add an additional delay
3. **Apply delay** - Rate-limited requests wait before proceeding (e.g., 5-30 seconds based on severity)
4. **Log the API call** - After successful Firecrawl call, record it for future rate limit checks

## Recommended Limits

| Limit Type | Threshold | Time Window | Delay Applied |
|------------|-----------|-------------|---------------|
| Per-IP | 20 new scrapes | 5 minutes | 10 seconds per request over limit |
| Global | 100 new scrapes | 1 minute | 5 seconds per request over limit |

These limits are generous for normal use (a kid searching 1-100 is fine), but make it impractical for someone to drain your quota quickly.

## User Experience

- **Normal users**: No change, instant responses for cached content, small wait for new scrapes
- **Heavy users**: Experience progressive slowdowns but still get results
- **Bad actors**: Get frustrated by delays and give up (30+ seconds per image makes abuse impractical)

The frontend will show a message like "High demand - your request is queued..." instead of an error.

---

## Technical Details

### Database Changes

Create a new `rate_limit_log` table to track Firecrawl API calls:

```sql
CREATE TABLE rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  api_calls_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_rate_limit_log_ip_time ON rate_limit_log(ip_address, created_at DESC);
CREATE INDEX idx_rate_limit_log_time ON rate_limit_log(created_at DESC);

-- Auto-cleanup old entries (older than 1 hour)
-- This keeps the table small
```

RLS Policy: Service role only (edge function uses service role key, no public access needed).

### Edge Function Changes

Update `scrape-numberblocks/index.ts` to:

1. Extract client IP from request headers
2. Before calling Firecrawl, check both limits
3. Calculate and apply delay if rate limited
4. Log successful API calls to the table
5. Return a special header indicating if user was throttled

Key code additions:

```typescript
// Get client IP
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('cf-connecting-ip') 
    || 'unknown';
}

// Check rate limits and return delay in ms
async function checkRateLimits(supabase, ip: string): Promise<number> {
  const now = new Date();
  
  // Check per-IP limit (last 5 minutes)
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const { data: ipCalls } = await supabase
    .from('rate_limit_log')
    .select('api_calls_count')
    .eq('ip_address', ip)
    .gte('created_at', fiveMinAgo.toISOString());
  
  const ipTotal = ipCalls?.reduce((sum, r) => sum + r.api_calls_count, 0) || 0;
  
  // Check global limit (last 1 minute)  
  const oneMinAgo = new Date(now.getTime() - 60 * 1000);
  const { data: globalCalls } = await supabase
    .from('rate_limit_log')
    .select('api_calls_count')
    .gte('created_at', oneMinAgo.toISOString());
  
  const globalTotal = globalCalls?.reduce((sum, r) => sum + r.api_calls_count, 0) || 0;
  
  // Calculate delay
  let delay = 0;
  if (ipTotal > 20) delay += (ipTotal - 20) * 10000; // 10s per extra call
  if (globalTotal > 100) delay += (globalTotal - 100) * 5000; // 5s per extra call
  
  return Math.min(delay, 60000); // Cap at 60 seconds
}

// Log API calls after successful Firecrawl request
async function logApiCalls(supabase, ip: string, count: number) {
  await supabase.from('rate_limit_log').insert({
    ip_address: ip,
    endpoint: 'scrape-numberblocks',
    api_calls_count: count
  });
}
```

### Cleanup Strategy

Add a scheduled cleanup or use database auto-expiry to delete entries older than 1 hour. This keeps the table small and queries fast.

### Files to Modify

| File | Changes |
|------|---------|
| Database migration | Create `rate_limit_log` table with indexes |
| `supabase/functions/scrape-numberblocks/index.ts` | Add rate limit checking, delays, and logging |
| `src/hooks/useNumberblocksScraper.ts` | (Optional) Show "high demand" message if throttled |

