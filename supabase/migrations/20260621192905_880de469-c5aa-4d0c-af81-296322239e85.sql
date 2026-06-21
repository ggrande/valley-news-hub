
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','editor','user');
CREATE TYPE public.post_status AS ENUM ('draft','review','published','archived');
CREATE TYPE public.post_source_type AS ENUM ('original','reddit_import','manual_import','wire_style','community_tip');
CREATE TYPE public.comment_source_type AS ENUM ('reddit','public','staff');
CREATE TYPE public.moderation_status AS ENUM ('pending','approved','hidden','removed');
CREATE TYPE public.import_status AS ENUM ('new','parsed','generated','published','discarded');

-- ============ UTIL ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles self read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

-- First signup becomes admin; subsequent get 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  SELECT COUNT(*) INTO existing_count FROM public.user_roles WHERE role = 'admin';
  IF existing_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ TAGS ============
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags public read" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tags admin write" ON public.tags FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ AUTHORS ============
CREATE TABLE public.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  avatar_url TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.authors TO anon, authenticated;
GRANT ALL ON public.authors TO service_role;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authors public read" ON public.authors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authors admin write" ON public.authors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ POSTS ============
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES public.authors(id) ON DELETE SET NULL,
  status public.post_status NOT NULL DEFAULT 'draft',
  featured_image TEXT,
  hero_caption TEXT,
  body TEXT,
  source_type public.post_source_type NOT NULL DEFAULT 'original',
  source_url TEXT,
  source_subreddit TEXT,
  source_post_id TEXT,
  original_source_title TEXT,
  original_source_body TEXT,
  generated_version TEXT,
  editor_notes TEXT,
  verification_notes TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seo_title TEXT,
  seo_description TEXT,
  og_image TEXT,
  related_post_ids UUID[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_breaking BOOLEAN NOT NULL DEFAULT false,
  is_weather_alert BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reddit_import_id UUID
);
CREATE INDEX posts_status_pub_idx ON public.posts(status, published_at DESC);
CREATE INDEX posts_category_idx ON public.posts(category_id);
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts public read published" ON public.posts FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "posts admin read all" ON public.posts FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "posts admin write" ON public.posts FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ POST VERSIONS ============
CREATE TABLE public.post_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.post_versions TO service_role;
GRANT SELECT, INSERT ON public.post_versions TO authenticated;
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_versions admin all" ON public.post_versions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ POST TAGS ============
CREATE TABLE public.post_tags (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id, tag_id)
);
GRANT SELECT ON public.post_tags TO anon, authenticated;
GRANT ALL ON public.post_tags TO service_role;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_tags public read" ON public.post_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "post_tags admin write" ON public.post_tags FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ COMMENTS ============
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  source_type public.comment_source_type NOT NULL DEFAULT 'public',
  source_comment_id TEXT,
  parent_source_comment_id TEXT,
  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  body TEXT NOT NULL,
  score INT,
  source_created_at TIMESTAMPTZ,
  nesting_level INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  moderation_status public.moderation_status NOT NULL DEFAULT 'approved',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON public.comments(post_id, sort_order);
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments public read visible" ON public.comments FOR SELECT TO anon, authenticated USING (is_hidden = false AND moderation_status = 'approved');
CREATE POLICY "comments admin all" ON public.comments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ REDDIT IMPORTS ============
CREATE TABLE public.reddit_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT,
  subreddit TEXT,
  reddit_post_id TEXT,
  original_title TEXT,
  original_body TEXT,
  original_author_display TEXT,
  original_created_at TIMESTAMPTZ,
  source_score INT,
  raw_comment_text TEXT,
  parsed_comments JSONB DEFAULT '[]'::jsonb,
  import_status public.import_status NOT NULL DEFAULT 'new',
  generated_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.reddit_imports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reddit_imports TO authenticated;
ALTER TABLE public.reddit_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reddit_imports admin all" ON public.reddit_imports FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_reddit_imports_updated BEFORE UPDATE ON public.reddit_imports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.posts ADD CONSTRAINT posts_reddit_import_fk FOREIGN KEY (reddit_import_id) REFERENCES public.reddit_imports(id) ON DELETE SET NULL;

-- ============ REDDIT IMPORT COMMENTS ============
CREATE TABLE public.reddit_import_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_import_id UUID NOT NULL REFERENCES public.reddit_imports(id) ON DELETE CASCADE,
  source_comment_id TEXT,
  parent_source_comment_id TEXT,
  display_name TEXT,
  body TEXT,
  score INT,
  source_created_at TIMESTAMPTZ,
  nesting_level INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.reddit_import_comments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reddit_import_comments TO authenticated;
ALTER TABLE public.reddit_import_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reddit_import_comments admin all" ON public.reddit_import_comments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ AI GENERATION LOGS ============
CREATE TABLE public.ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reddit_import_id UUID REFERENCES public.reddit_imports(id) ON DELETE SET NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  prompt TEXT,
  model TEXT,
  variation TEXT,
  result JSONB,
  tokens_used INT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_generation_logs TO service_role;
GRANT SELECT, INSERT ON public.ai_generation_logs TO authenticated;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_logs admin all" ON public.ai_generation_logs FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ MEDIA ASSETS ============
CREATE TABLE public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  storage_path TEXT,
  filename TEXT,
  mime_type TEXT,
  width INT,
  height INT,
  alt_text TEXT,
  credit TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT ALL ON public.media_assets TO service_role;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media public read" ON public.media_assets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "media admin write" ON public.media_assets FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ SITE SETTINGS ============
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings admin write" ON public.site_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ NEWS TIPS ============
CREATE TABLE public.news_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  category TEXT,
  summary TEXT NOT NULL,
  details TEXT,
  allow_contact BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.news_tips TO anon, authenticated;
GRANT ALL ON public.news_tips TO service_role;
ALTER TABLE public.news_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tips public submit" ON public.news_tips FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tips admin read" ON public.news_tips FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "tips admin update" ON public.news_tips FOR UPDATE TO authenticated USING (public.is_admin());

-- ============ COMMUNITY EVENTS ============
CREATE TABLE public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date DATE,
  event_time TEXT,
  submitter_name TEXT,
  submitter_email TEXT,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.community_events TO anon, authenticated;
GRANT SELECT ON public.community_events TO anon, authenticated;
GRANT ALL ON public.community_events TO service_role;
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public submit" ON public.community_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "events public read approved" ON public.community_events FOR SELECT TO anon, authenticated USING (is_approved = true);
CREATE POLICY "events admin all" ON public.community_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============ NEWSLETTERS ============
CREATE TABLE public.newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  preferences JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletters TO anon, authenticated;
GRANT ALL ON public.newsletters TO service_role;
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter public signup" ON public.newsletters FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "newsletter admin read" ON public.newsletters FOR SELECT TO authenticated USING (public.is_admin());

-- ============ CONTACT SUBMISSIONS ============
CREATE TABLE public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  department TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  is_handled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_submissions TO anon, authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contact public submit" ON public.contact_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "contact admin read" ON public.contact_submissions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "contact admin update" ON public.contact_submissions FOR UPDATE TO authenticated USING (public.is_admin());

-- ============ AD INQUIRIES ============
CREATE TABLE public.ad_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  budget_range TEXT,
  campaign_type TEXT,
  details TEXT,
  is_handled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.ad_inquiries TO anon, authenticated;
GRANT ALL ON public.ad_inquiries TO service_role;
ALTER TABLE public.ad_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads public submit" ON public.ad_inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "ads admin read" ON public.ad_inquiries FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "ads admin update" ON public.ad_inquiries FOR UPDATE TO authenticated USING (public.is_admin());
