-- Reddit comment automation: settings, queue, audit log

CREATE TABLE public.reddit_automation_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  mode TEXT NOT NULL DEFAULT 'off' CHECK (mode IN ('off','dry_run','approval','live')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  reddit_username TEXT,
  reddit_password_encrypted TEXT,
  reddit_password_iv TEXT,
  session_cookies_encrypted TEXT,
  session_cookies_iv TEXT,
  session_captured_at TIMESTAMPTZ,
  session_status TEXT DEFAULT 'none' CHECK (session_status IN ('none','active','expired','challenge_required','error')),
  session_last_error TEXT,
  template_markdown TEXT NOT NULL DEFAULT $$Hi r/{{subreddit}} — just letting you know your story has been featured on WKNA49:

**{{article_title}}**
{{article_url}}

If we got anything wrong or you'd like an update / correction, reply here or contact us directly: https://wkna49.com/contact

— u/WKNA49$$,
  rate_per_hour INT NOT NULL DEFAULT 4,
  rate_per_day INT NOT NULL DEFAULT 20,
  github_workflow_ref TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reddit_automation_settings TO authenticated;
GRANT ALL ON public.reddit_automation_settings TO service_role;
ALTER TABLE public.reddit_automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reddit automation settings"
  ON public.reddit_automation_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER reddit_automation_settings_updated_at
  BEFORE UPDATE ON public.reddit_automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.reddit_automation_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE public.reddit_comment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  reddit_import_id UUID REFERENCES public.reddit_imports(id) ON DELETE SET NULL,
  thread_url TEXT NOT NULL,
  thread_id TEXT,
  subreddit TEXT,
  rendered_comment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','awaiting_approval','dispatched','posted','failed','skipped','dry_run_only')),
  mode_at_enqueue TEXT NOT NULL,
  reddit_comment_id TEXT,
  reddit_comment_permalink TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  failure_reason TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reddit_comment_notifications TO authenticated;
GRANT ALL ON public.reddit_comment_notifications TO service_role;
ALTER TABLE public.reddit_comment_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage reddit notifications"
  ON public.reddit_comment_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER reddit_comment_notifications_updated_at
  BEFORE UPDATE ON public.reddit_comment_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX reddit_comment_notifications_status_idx
  ON public.reddit_comment_notifications (status, created_at);

CREATE TABLE public.reddit_comment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.reddit_comment_notifications(id) ON DELETE CASCADE,
  attempt_no INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('started','succeeded','failed','login_required','challenge_required','thread_locked','duplicate')),
  github_run_id TEXT,
  github_run_url TEXT,
  log_excerpt TEXT,
  screenshot_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reddit_comment_attempts TO authenticated;
GRANT ALL ON public.reddit_comment_attempts TO service_role;
ALTER TABLE public.reddit_comment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view reddit attempts"
  ON public.reddit_comment_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX reddit_comment_attempts_notification_idx
  ON public.reddit_comment_attempts (notification_id, attempt_no);