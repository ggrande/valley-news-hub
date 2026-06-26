# Court of Public Opinion — Verdict Arena

A flashy, real-time tug-of-war where readers spend **Verdict Credits** to **KEEP** or **REMOVE** a controversial article. Battles end via a momentum-threshold rule, ghost contributors keep early battles alive, and a quadratic + dynamic cost curve keeps whales powerful but not omnipotent.

## Feature flag (kill switch)

Single setting `verdict_arena_enabled` (default **off**) in `site_settings`. When off:
- No Arena UI renders anywhere.
- No wallet badge in header.
- "Open battle" controls hidden in admin.
- Existing battles remain in DB but article pages render normally.
- Cron tick is a no-op.
- Site looks 100% identical to today.

## Scope

- Opt-in per post: admin toggles `is_controversial` on a post. Battles never appear on regular news.
- Currency: **Verdict Credits** (virtual). 50/day free + optional Stripe top-up.
- Identity: frictionless. Browser fingerprint + IP is the default. No email or signup required to vote.
- Outcome: losing side → post fully unpublished, header replaced with "Removed by public verdict" banner, body rendered as █ blocks (original preserved in DB for admin restore).

## User experience

**On a controversial article**, a sticky **Verdict Arena** panel appears below the hero:
- Two columns: **KEEP** (gold) vs **REMOVE** (crimson). A center rope shifts based on credit share.
- Live momentum indicator (arrow + "+312 credits in last 5 min on KEEP").
- Vote button shows your next-vote cost.
- Big flashy moment per vote: rope yanks with spring animation, particles burst from the winning side, screen-shake on votes ≥100 credits, "WHALE INCOMING" banner ≥500.
- Recent voters ticker (mixes real + ghost handles).
- Status line: "REMOVE needs to hold +500 lead for 8 more minutes to win."

**Wallet badge** in header (coin icon):
- Balance, "Claim daily 50" button, top-up modal (packs via Stripe embedded checkout).
- Voting itself is anonymous — wallet is tied to a signed HttpOnly fingerprint cookie.

**Removed post state**: hero replaced with `RemovedArticle` banner (verdict tally, link to "Why this was removed" explainer). Body component renders block characters of equivalent length per paragraph. Comments hidden. Schema.org/sitemap/RSS suppressed. `noindex` meta added.

## Mechanics

### Win condition — threshold + momentum
- Battle is live indefinitely once opened.
- Side wins when lead ≥ **L credits** for **T continuous minutes**, where L and T scale with total volume.
  - Small battles: L=200, T=5 min.
  - Big battles: L=2,000, T=15 min.
- Lead-flip resets the timer → comeback windows.
- Hard ceiling: 7 days max; current leader wins at expiry.

### Cost curve
Per-user *n*-th vote in a battle:
```
base_cost(n) = ceil(n^1.6)               // softer than pure quadratic
dynamic_mult = 1 + (your_side_share - 0.5) * engagement_factor
final_cost   = ceil(base_cost * max(0.5, dynamic_mult))
```
- `engagement_factor` grows with unique participants (more voices → harder to dominate).
- Winning side pays more per vote; underdog discounted (encourages comebacks).
- Whales can still swing quiet battles; in a hot battle their 50th vote might cost 800 credits.

### Verdict Credits economy
- Daily claim: **50 credits** per identity (fingerprint+IP gated).
- Top-up packs via Stripe embedded checkout (real money, **live from day 1**, reusing `createStripeClient` from `stripe.server.ts`):
  - 100 credits — $1.99
  - 500 credits — $7.99
  - 2,500 credits — $29.99
- Credits non-refundable, non-withdrawable (avoids gambling classification — votes are entertainment, no cash payout).
- **Victory dividend**: when a battle resolves, every wallet on the winning side gets **ceil(10% of credits they spent in that battle)** refunded. Loop incentive, still no cash out.

### Ghost contributors (cold-start & testing)
- `ghost_personas` table: ~60 fictional handles with personality weights (bias, frequency, avg size).
- Background drip via cron + on each real vote (`tickGhosts(battleId)`).
- Ghost weight tapers as real participants join.
- Per-battle `ghost_mode = 'aggressive' | 'subtle' | 'off'` (default subtle).
- Production safety: ghost votes flagged `is_ghost=true`. Config `ghost_can_decide` (default **false**) means ghosts never push a battle past the win threshold — only real credits trigger removal. Easy to flip on for testing.

### Anti-abuse (no friction by default)
1. **Signed HttpOnly fingerprint cookie** — primary identity. Derived from a stable browser fingerprint + server-side random salt; signed with a server secret.
2. **IP hash** — second key. Daily claim & per-minute vote rate-limited per IP.
3. **Cookie + IP combo gate** — new cookie + same IP within 24h ≠ fresh daily claim.
4. **Velocity heuristics** — flag suspicious patterns (e.g. 10 identical votes from same /24 in 60s) → wallet quarantined for admin review.
5. **Optional escalation** — only if abuse heuristics fire, the wallet is prompted for a magic-link email verification to keep voting (reuses `tenant-auth.functions.ts` pattern). Honest users never see it.
6. Acknowledged tradeoff: no native rate-limit primitive — we use a Postgres counter table with windowed rows.

## Data model (new tables, all RLS-locked, writes through server fns)

- `verdict_battles` — `id, post_id, status (live|decided|cancelled), winner, opened_at, decided_at, lead_threshold, momentum_window_sec, ghost_mode, current_lead_side, lead_since, totals_jsonb`
- `verdict_votes` — `id, battle_id, wallet_id, fingerprint_hash, ip_hash, side, credits, vote_n, cost_charged, is_ghost, created_at`
- `verdict_wallets` — `id, fingerprint_hash (unique), balance, lifetime_purchased, last_daily_claim_at, quarantined`
- `verdict_credit_packs` — Stripe purchases ledger (pack_id, stripe_session, credits_granted, wallet_id)
- `ghost_personas` — `id, handle, bias, frequency, size_curve`
- `verdict_abuse_flags` — `wallet_id, ip_hash, reason, created_at`
- `verdict_rate_windows` — windowed counter rows for ad-hoc rate limiting

Public read: only aggregated battle state via SECURITY DEFINER function. Per-vote rows never exposed.

## Server functions / routes

- `getBattleState(postId)` — public; returns tallies, your-next-cost, momentum, ticker, status.
- `castVote({battleId, side, credits})` — fingerprint-gated; atomic SELECT FOR UPDATE on battle + wallet; runs cost curve; checks win condition; emits realtime event.
- `claimDailyCredits()` — fingerprint+IP gated.
- `purchaseCreditPack(packId)` — Stripe embedded checkout → webhook credits wallet.
- `tickGhosts(battleId)` — internal; invoked by cron + on each real vote.
- `adminToggleControversial(postId)` / `adminOpenBattle(postId)` / `adminRestorePost(postId)` — admin only.
- `/api/public/hooks/verdict-ghost-tick` — pg_cron every 1 min using `apikey` header (canonical pattern).
- Stripe webhook extended in `src/routes/api/public/payments/webhook.ts` to credit wallets on `verdict_pack` purchases.

All gated behind `verdict_arena_enabled`; when off, server fns short-circuit with `{ disabled: true }`.

## Real-time

- Supabase Realtime channel `battle:{id}` — broadcasts each vote so the rope animates live for all viewers (throttled to 4 events/sec per battle).

## Post removal flow

1. Battle resolves → `posts.status = 'community_removed'`, snapshot original body to `posts.removed_snapshot`.
2. `news.$slug.tsx` detects status → renders `<RemovedArticle>`.
3. Suppressed from sitemap, RSS, news-sitemap, schema.org JSON-LD; `<meta name="robots" content="noindex,nofollow">` injected.
4. Admin can restore from `/admin/posts/$id` or new `/admin/verdict` dashboard.

## Affiliate site posture

wkna49.com-only initially. Affiliate stations get a `features.verdict_arena` flag defaulting **off** so this never auto-ships to their mirrors.

## Files

**New**
- `supabase/migrations/<ts>_verdict_arena.sql` — tables, RLS, grants, SECURITY DEFINER read fn, helper fns.
- `src/lib/verdict.functions.ts` — server fns (getBattleState, castVote, claimDailyCredits, purchaseCreditPack, admin fns).
- `src/lib/verdict-ghost.server.ts` — ghost engine.
- `src/lib/verdict-abuse.server.ts` — fingerprint/IP rate limiter + quarantine heuristics.
- `src/lib/verdict-fingerprint.ts` — client fingerprint helper.
- `src/components/site/VerdictArena.tsx` — sticky tug-of-war UI.
- `src/components/site/verdict/Rope.tsx`, `Ticker.tsx`, `VoteButton.tsx`, `WhalePulse.tsx`, `WalletDrawer.tsx`, `TopUpModal.tsx`.
- `src/components/site/RemovedArticle.tsx` — banner + █ body.
- `src/components/site/WalletBadge.tsx` — header coin pill.
- `src/routes/api/public/hooks/verdict-ghost-tick.ts` — cron endpoint (apikey-authed).
- `src/routes/_authenticated/admin.verdict.tsx` — admin dashboard (live battles, ghost mode, restore, kill-switch).

**Modified**
- `src/routes/news.$slug.tsx` — when flag on AND `is_controversial`: mount `<VerdictArena>`; when status `community_removed`: render `<RemovedArticle>`.
- `src/routes/news-sitemap[.]xml.ts`, `src/routes/rss[.]xml.ts`, `src/routes/sitemap[.]xml.ts` — suppress `community_removed`.
- `src/routes/_authenticated/admin.posts.$id.tsx` — Controversial toggle + Open Battle button (flag-gated).
- `src/routes/_authenticated/admin.settings.tsx` — add `verdict_arena_enabled` toggle.
- `src/components/site/Header.tsx` — conditional `<WalletBadge>`.
- `src/routes/api/public/payments/webhook.ts` — handle `verdict_pack` checkout completion.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Secrets**
- `VERDICT_FINGERPRINT_SIGNING_KEY` — generated via `generate_secret`.

## Build pre-check

Current build is failing on a Vite chunk error (pre-existing). I'll triage and fix that first in build mode before layering this feature in.

## Defaults locked in

- Daily claim: 50 credits.
- Anonymous voting via fingerprint+IP; email magic-link only as abuse escalation.
- Victory dividend: 10%, rounded up.
- Stripe top-ups live from day 1.
- Feature globally toggleable; off = invisible.
