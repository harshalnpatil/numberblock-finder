-- Create rate limit log table for tracking Firecrawl API calls
CREATE TABLE public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  endpoint text NOT NULL,
  api_calls_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient per-IP queries
CREATE INDEX idx_rate_limit_log_ip_time ON public.rate_limit_log(ip_address, created_at DESC);

-- Index for efficient global queries
CREATE INDEX idx_rate_limit_log_time ON public.rate_limit_log(created_at DESC);

-- Enable RLS (no public access - only service role can access)
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- No public policies - edge function uses service role key which bypasses RLS