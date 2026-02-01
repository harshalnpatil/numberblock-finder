-- Create storage bucket for cached numberblocks images
INSERT INTO storage.buckets (id, name, public)
VALUES ('numberblocks-images', 'numberblocks-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the bucket
CREATE POLICY "Public can view numberblocks images"
ON storage.objects FOR SELECT
USING (bucket_id = 'numberblocks-images');

-- Allow edge functions to upload images (using service role)
CREATE POLICY "Service role can upload numberblocks images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'numberblocks-images');

-- Create a table to track which numbers have been cached
CREATE TABLE public.numberblocks_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  original_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read
ALTER TABLE public.numberblocks_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cache entries"
ON public.numberblocks_cache FOR SELECT
USING (true);