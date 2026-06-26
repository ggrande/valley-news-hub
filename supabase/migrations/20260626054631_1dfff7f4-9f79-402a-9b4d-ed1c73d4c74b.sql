
CREATE TABLE public.reddit_listing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subreddit TEXT NOT NULL,
  sort TEXT NOT NULL DEFAULT 'new',
  top_window TEXT,
  limit_per_sub INTEGER NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'queued',
  triggered_by TEXT NOT NULL DEFAULT 'manual',
  posts_count INTEGER,
  imported_count INTEGER,
  error TEXT,
  github_run_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  CHECK (status IN ('queued','dispatched','succeeded','failed'))
);

GRANT SELECT ON public.reddit_listing_jobs TO authenticated;
GRANT ALL ON public.reddit_listing_jobs TO service_role;

ALTER TABLE public.reddit_listing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reddit listing jobs"
  ON public.reddit_listing_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX reddit_listing_jobs_created_idx ON public.reddit_listing_jobs (created_at DESC);
