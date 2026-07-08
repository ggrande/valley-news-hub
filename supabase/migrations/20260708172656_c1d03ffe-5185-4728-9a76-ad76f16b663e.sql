
ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS ai_mode TEXT NOT NULL DEFAULT 'lovable' CHECK (ai_mode IN ('lovable','disabled','byo_gemini')),
  ADD COLUMN IF NOT EXISTS ai_provider_api_key_enc TEXT,
  ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS ai_posts_quota_per_min INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ai_posts_quota_per_day INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ai_posts_quota_per_month INT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS ai_images_quota_per_min INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ai_images_quota_per_day INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ai_images_quota_per_month INT NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS public.tenant_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  managed_site_id UUID NOT NULL REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  op_type TEXT NOT NULL CHECK (op_type IN ('post','image','other')),
  ai_mode TEXT NOT NULL,
  model TEXT,
  tokens_in INT,
  tokens_out INT,
  succeeded BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_usage_site_created ON public.tenant_ai_usage(managed_site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_usage_op_created ON public.tenant_ai_usage(op_type, created_at DESC);

GRANT SELECT ON public.tenant_ai_usage TO authenticated;
GRANT ALL ON public.tenant_ai_usage TO service_role;

ALTER TABLE public.tenant_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all tenant AI usage"
  ON public.tenant_ai_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages tenant AI usage"
  ON public.tenant_ai_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);
