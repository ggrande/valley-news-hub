-- 1. import_batches table
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text,
  source_filename text,
  size_bytes bigint,
  total_posts integer NOT NULL DEFAULT 0,
  total_comments integer NOT NULL DEFAULT 0,
  total_media integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_batches admin all" ON public.import_batches
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER trg_import_batches_updated BEFORE UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Extend reddit_imports
ALTER TABLE public.reddit_imports
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS permalink text,
  ADD COLUMN IF NOT EXISTS link_flair_text text,
  ADD COLUMN IF NOT EXISTS media_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processing_error text;

CREATE INDEX IF NOT EXISTS reddit_imports_batch_idx ON public.reddit_imports(batch_id);
CREATE INDEX IF NOT EXISTS reddit_imports_status_idx ON public.reddit_imports(import_status);
CREATE UNIQUE INDEX IF NOT EXISTS reddit_imports_reddit_post_uniq ON public.reddit_imports(reddit_post_id) WHERE reddit_post_id IS NOT NULL;

-- 3. Extend posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS original_permalink text,
  ADD COLUMN IF NOT EXISTS original_flair text;

-- 4. Storage buckets (created via tool elsewhere if needed; this migration only handles RLS policies on storage.objects)
-- Policies on storage.objects for these buckets
CREATE POLICY "reddit-archives admin all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'reddit-archives' AND is_admin())
  WITH CHECK (bucket_id = 'reddit-archives' AND is_admin());

CREATE POLICY "news-media public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'news-media');

CREATE POLICY "news-media admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'news-media' AND is_admin());

CREATE POLICY "news-media admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'news-media' AND is_admin())
  WITH CHECK (bucket_id = 'news-media' AND is_admin());

CREATE POLICY "news-media admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'news-media' AND is_admin());