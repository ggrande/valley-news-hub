
-- ============ VERDICT ARENA ============

-- 1. posts: track controversial flag + removal snapshot
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_controversial BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS removed_snapshot JSONB;

-- allow new post status value
DO $$ BEGIN
  -- status is plain text in this codebase, no enum to alter; nothing to do
  PERFORM 1;
END $$;

-- 2. battles
CREATE TABLE IF NOT EXISTS public.verdict_battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','decided','cancelled')),
  winner TEXT CHECK (winner IN ('keep','remove')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  lead_threshold INTEGER NOT NULL DEFAULT 200,
  momentum_window_sec INTEGER NOT NULL DEFAULT 300,
  ghost_mode TEXT NOT NULL DEFAULT 'subtle' CHECK (ghost_mode IN ('off','subtle','aggressive')),
  current_lead_side TEXT CHECK (current_lead_side IN ('keep','remove')),
  lead_since TIMESTAMPTZ,
  keep_credits BIGINT NOT NULL DEFAULT 0,
  remove_credits BIGINT NOT NULL DEFAULT 0,
  participant_count INTEGER NOT NULL DEFAULT 0,
  ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verdict_battles_post ON public.verdict_battles(post_id);
CREATE INDEX IF NOT EXISTS idx_verdict_battles_live ON public.verdict_battles(status) WHERE status='live';

GRANT SELECT ON public.verdict_battles TO anon, authenticated;
GRANT ALL ON public.verdict_battles TO service_role;
ALTER TABLE public.verdict_battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "battles_public_read" ON public.verdict_battles FOR SELECT TO anon, authenticated USING (true);

-- 3. wallets (anonymous, fingerprint-keyed)
CREATE TABLE IF NOT EXISTS public.verdict_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash TEXT NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_purchased INTEGER NOT NULL DEFAULT 0,
  lifetime_earned INTEGER NOT NULL DEFAULT 0,
  last_daily_claim_at TIMESTAMPTZ,
  quarantined BOOLEAN NOT NULL DEFAULT FALSE,
  verified_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.verdict_wallets TO service_role;
ALTER TABLE public.verdict_wallets ENABLE ROW LEVEL SECURITY;
-- no public policies; only server fns via service role

-- 4. votes
CREATE TABLE IF NOT EXISTS public.verdict_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.verdict_battles(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES public.verdict_wallets(id) ON DELETE SET NULL,
  fingerprint_hash TEXT,
  ip_hash TEXT,
  side TEXT NOT NULL CHECK (side IN ('keep','remove')),
  credits INTEGER NOT NULL,
  vote_n INTEGER NOT NULL,
  cost_charged INTEGER NOT NULL,
  is_ghost BOOLEAN NOT NULL DEFAULT FALSE,
  ghost_handle TEXT,
  dividend_paid INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verdict_votes_battle ON public.verdict_votes(battle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verdict_votes_wallet ON public.verdict_votes(wallet_id);
GRANT ALL ON public.verdict_votes TO service_role;
ALTER TABLE public.verdict_votes ENABLE ROW LEVEL SECURITY;

-- 5. credit pack purchases
CREATE TABLE IF NOT EXISTS public.verdict_credit_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.verdict_wallets(id) ON DELETE CASCADE,
  pack_id TEXT NOT NULL,
  credits_granted INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  environment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.verdict_credit_packs TO service_role;
ALTER TABLE public.verdict_credit_packs ENABLE ROW LEVEL SECURITY;

-- 6. ghost personas
CREATE TABLE IF NOT EXISTS public.ghost_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL UNIQUE,
  bias NUMERIC NOT NULL DEFAULT 0, -- -1..1 (negative=keep, positive=remove)
  frequency NUMERIC NOT NULL DEFAULT 0.5, -- 0..1
  size_min INTEGER NOT NULL DEFAULT 1,
  size_max INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ghost_personas TO anon, authenticated;
GRANT ALL ON public.ghost_personas TO service_role;
ALTER TABLE public.ghost_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ghosts_public_read" ON public.ghost_personas FOR SELECT TO anon, authenticated USING (true);

-- 7. abuse flags
CREATE TABLE IF NOT EXISTS public.verdict_abuse_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.verdict_wallets(id) ON DELETE CASCADE,
  ip_hash TEXT,
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.verdict_abuse_flags TO service_role;
ALTER TABLE public.verdict_abuse_flags ENABLE ROW LEVEL SECURITY;

-- 8. rate windows (ad-hoc rate limiting)
CREATE TABLE IF NOT EXISTS public.verdict_rate_windows (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_verdict_rate_windows_ws ON public.verdict_rate_windows(window_start);
GRANT ALL ON public.verdict_rate_windows TO service_role;
ALTER TABLE public.verdict_rate_windows ENABLE ROW LEVEL SECURITY;

-- 9. updated_at trigger reuse
CREATE TRIGGER verdict_battles_updated_at
  BEFORE UPDATE ON public.verdict_battles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER verdict_wallets_updated_at
  BEFORE UPDATE ON public.verdict_wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER verdict_credit_packs_updated_at
  BEFORE UPDATE ON public.verdict_credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10. Public aggregate read fn (so anon can read battle state safely)
CREATE OR REPLACE FUNCTION public.get_battle_state(_post_id UUID)
RETURNS TABLE (
  battle_id UUID,
  status TEXT,
  winner TEXT,
  keep_credits BIGINT,
  remove_credits BIGINT,
  participant_count INTEGER,
  lead_threshold INTEGER,
  momentum_window_sec INTEGER,
  current_lead_side TEXT,
  lead_since TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, status, winner, keep_credits, remove_credits, participant_count,
         lead_threshold, momentum_window_sec, current_lead_side, lead_since,
         opened_at, decided_at, ends_at
  FROM public.verdict_battles
  WHERE post_id = _post_id
  ORDER BY opened_at DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_battle_state(UUID) TO anon, authenticated;

-- 11. Recent voter ticker
CREATE OR REPLACE FUNCTION public.get_battle_ticker(_battle_id UUID, _limit INTEGER DEFAULT 20)
RETURNS TABLE (side TEXT, credits INTEGER, label TEXT, is_ghost BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT side, credits,
         COALESCE(ghost_handle, 'anon_' || substr(fingerprint_hash, 1, 6)) AS label,
         is_ghost, created_at
  FROM public.verdict_votes
  WHERE battle_id = _battle_id
  ORDER BY created_at DESC
  LIMIT LEAST(_limit, 50);
$$;
GRANT EXECUTE ON FUNCTION public.get_battle_ticker(UUID, INTEGER) TO anon, authenticated;

-- 12. Seed ghost personas
INSERT INTO public.ghost_personas (handle, bias, frequency, size_min, size_max)
SELECT * FROM (VALUES
  ('valley_voter', -0.2, 0.7, 1, 8),
  ('charleston_chris', 0.3, 0.6, 1, 12),
  ('kanawha_kate', -0.4, 0.8, 2, 15),
  ('mountainstate_mike', 0.1, 0.5, 1, 6),
  ('appalachian_ann', -0.6, 0.4, 3, 20),
  ('coal_country_carl', 0.5, 0.6, 1, 10),
  ('newsroom_nancy', 0.0, 0.9, 1, 5),
  ('elk_river_eli', -0.3, 0.5, 2, 14),
  ('south_hills_sam', 0.4, 0.7, 1, 18),
  ('riverbend_ronnie', -0.1, 0.6, 1, 9),
  ('capitol_cassie', 0.2, 0.5, 2, 11),
  ('blue_ridge_ben', -0.5, 0.4, 3, 16),
  ('teays_tonya', 0.6, 0.6, 1, 8),
  ('hurricane_hank', -0.2, 0.7, 1, 12),
  ('nitro_nadia', 0.3, 0.5, 2, 10),
  ('cross_lanes_cody', -0.4, 0.6, 1, 15),
  ('saint_albans_sue', 0.1, 0.8, 1, 7),
  ('dunbar_dave', -0.7, 0.4, 4, 22),
  ('marmet_marie', 0.4, 0.5, 1, 9),
  ('belle_brad', -0.1, 0.6, 2, 13),
  ('chesapeake_chip', 0.5, 0.7, 1, 11),
  ('rand_rebecca', -0.3, 0.5, 1, 8),
  ('quincy_quinn', 0.2, 0.6, 2, 14),
  ('shawnee_sherry', -0.6, 0.4, 3, 18),
  ('alum_creek_al', 0.0, 0.9, 1, 5),
  ('eskdale_ed', -0.5, 0.5, 2, 12),
  ('cabin_creek_cal', 0.7, 0.4, 1, 20),
  ('paint_creek_pam', -0.2, 0.7, 1, 9),
  ('boone_county_bo', 0.3, 0.6, 2, 11),
  ('logan_liz', -0.4, 0.5, 1, 14),
  ('lincoln_lou', 0.1, 0.8, 1, 6),
  ('wayne_warren', -0.3, 0.6, 2, 10),
  ('mason_max', 0.5, 0.5, 1, 16),
  ('putnam_penny', -0.6, 0.4, 3, 19),
  ('jackson_jay', 0.2, 0.7, 1, 8),
  ('roane_rachel', -0.1, 0.6, 2, 13),
  ('clay_chuck', 0.4, 0.5, 1, 11),
  ('nicholas_nina', -0.5, 0.4, 3, 17),
  ('fayette_fred', 0.3, 0.6, 1, 10),
  ('greenbrier_gail', -0.2, 0.7, 1, 9),
  ('summers_sid', 0.6, 0.5, 2, 14),
  ('raleigh_rosie', -0.4, 0.6, 1, 12),
  ('mercer_marvin', 0.1, 0.8, 1, 7),
  ('mcdowell_mae', -0.7, 0.4, 4, 21),
  ('wyoming_wally', 0.5, 0.5, 1, 15),
  ('mingo_meg', -0.3, 0.6, 2, 11),
  ('upshur_ulysses', 0.2, 0.7, 1, 9),
  ('barbour_beth', -0.5, 0.5, 3, 18),
  ('lewis_lance', 0.4, 0.6, 1, 13),
  ('harrison_harriet', -0.1, 0.8, 1, 6),
  ('marion_mary', 0.3, 0.6, 2, 10),
  ('monongalia_monty', -0.4, 0.5, 1, 14),
  ('preston_pete', 0.6, 0.4, 2, 16),
  ('taylor_tess', -0.2, 0.7, 1, 9),
  ('tucker_ty', 0.1, 0.6, 1, 8),
  ('randolph_rae', -0.6, 0.4, 3, 19),
  ('webster_wes', 0.5, 0.5, 1, 12),
  ('pocahontas_paul', -0.3, 0.6, 2, 11),
  ('pendleton_pippa', 0.4, 0.7, 1, 10),
  ('hardy_hugh', -0.5, 0.5, 1, 14)
) AS t(handle, bias, frequency, size_min, size_max)
ON CONFLICT (handle) DO NOTHING;

-- 13. Seed default settings
INSERT INTO public.site_settings (key, value)
VALUES
  ('verdict_arena_enabled', 'false'::jsonb),
  ('verdict_ghost_can_decide', 'false'::jsonb),
  ('verdict_daily_claim', '50'::jsonb)
ON CONFLICT (key) DO NOTHING;
