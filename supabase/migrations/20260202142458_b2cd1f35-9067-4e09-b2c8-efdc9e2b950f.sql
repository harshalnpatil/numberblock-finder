-- Deny all public access to rate_limit_log (edge functions use service role, bypassing RLS)
CREATE POLICY "No public access to rate limit logs"
ON public.rate_limit_log
FOR ALL
USING (false)
WITH CHECK (false);