ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reddit_comment_url text,
  ADD COLUMN IF NOT EXISTS reddit_comment_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reddit_comment_error text;