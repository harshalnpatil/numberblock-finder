ALTER TABLE public.numberblocks_cache
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Backfill provenance from the existing storage-path prefixes
UPDATE public.numberblocks_cache
SET source = CASE
  WHEN storage_path LIKE 'ai-%' THEN 'ai'
  WHEN storage_path LIKE 'gem-%' THEN 'ai'
  WHEN storage_path LIKE 'svg-%' THEN 'render'
  WHEN storage_path LIKE 'comp-%' THEN 'compose'
  ELSE 'wiki'
END,
model = CASE
  WHEN storage_path LIKE 'ai-%' THEN 'openai'
  WHEN storage_path LIKE 'gem-%' THEN 'gemini'
  ELSE model
END
WHERE source = 'unknown';

-- Deterministic renders are correct by construction
UPDATE public.numberblocks_cache
SET verified = true, verification_note = 'deterministic render', verified_at = now()
WHERE source = 'render' AND verified = false;

ALTER TABLE public.numberblocks_cache
  ADD CONSTRAINT numberblocks_cache_source_check
  CHECK (source IN ('wiki', 'ai', 'render', 'compose', 'unknown'));