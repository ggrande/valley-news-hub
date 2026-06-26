
-- Tenant Supabase OAuth + provisioning state on managed_sites
ALTER TABLE public.managed_sites
  ADD COLUMN IF NOT EXISTS provision_state text NOT NULL DEFAULT 'awaiting_oauth',
  ADD COLUMN IF NOT EXISTS provision_error text,
  ADD COLUMN IF NOT EXISTS provision_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS supabase_org_id text,
  ADD COLUMN IF NOT EXISTS supabase_org_name text,
  ADD COLUMN IF NOT EXISTS supabase_project_ref text,
  ADD COLUMN IF NOT EXISTS supabase_project_url text,
  ADD COLUMN IF NOT EXISTS supabase_refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS supabase_refresh_token_iv text,
  ADD COLUMN IF NOT EXISTS supabase_access_token_enc text,
  ADD COLUMN IF NOT EXISTS supabase_access_token_iv text,
  ADD COLUMN IF NOT EXISTS supabase_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS supabase_db_password_enc text,
  ADD COLUMN IF NOT EXISTS supabase_db_password_iv text,
  ADD COLUMN IF NOT EXISTS supabase_anon_key_enc text,
  ADD COLUMN IF NOT EXISTS supabase_anon_key_iv text,
  ADD COLUMN IF NOT EXISTS supabase_service_key_enc text,
  ADD COLUMN IF NOT EXISTS supabase_service_key_iv text;

-- Short-lived CSRF state for the Supabase OAuth handshake.
CREATE TABLE IF NOT EXISTS public.supabase_oauth_states (
  state text PRIMARY KEY,
  code_verifier text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.managed_sites(id) ON DELETE CASCADE,
  redirect_after text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.supabase_oauth_states TO service_role;

ALTER TABLE public.supabase_oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (server-only) ever touches this table.

CREATE INDEX IF NOT EXISTS idx_supabase_oauth_states_expires_at
  ON public.supabase_oauth_states (expires_at);
