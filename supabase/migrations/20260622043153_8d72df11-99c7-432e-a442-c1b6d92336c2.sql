
ALTER TABLE public.reddit_imports ADD COLUMN IF NOT EXISTS candidate_hero_image_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS candidate_hero_image_url text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hero_image_decision text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hero_image_reason text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hero_image_alt text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hero_crop_hint text;
