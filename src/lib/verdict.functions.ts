// Verdict Arena server functions — battle state, voting, daily claim, top-ups.
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getCookie, setCookie } from "@tanstack/react-start/server";

const FP_COOKIE = "wkna_verdict_fp";
const FP_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function isEnabled(admin: any): Promise<boolean> {
  const { data } = await admin
    .from("site_settings").select("value").eq("key", "verdict_arena_enabled").maybeSingle();
  return data?.value === true;
}

async function dailyClaimAmount(admin: any): Promise<number> {
  const { data } = await admin
    .from("site_settings").select("value").eq("key", "verdict_daily_claim").maybeSingle();
  const v = data?.value;
  return typeof v === "number" ? v : 50;
}

async function resolveWallet(admin: any, fingerprint: string) {
  const { hashFingerprint, hashIp, extractIp } = await import("./verdict-abuse.server");
  const req = getRequest();
  const ip = extractIp(req);
  const ipHash = hashIp(ip);

  // Prefer signed wallet token from cookie when present
  const cookieToken = getCookie(FP_COOKIE);
  if (cookieToken) {
    const { data } = await admin
      .from("verdict_wallets")
      .select("*")
      .eq("fingerprint_hash", cookieToken)
      .maybeSingle();
    if (data) return { wallet: data, fingerprintHash: cookieToken, ipHash };
  }

  const fpHash = hashFingerprint(fingerprint);
  const { data: existing } = await admin
    .from("verdict_wallets")
    .select("*")
    .eq("fingerprint_hash", fpHash)
    .maybeSingle();

  let wallet = existing;
  if (!wallet) {
    const { data: created } = await admin
      .from("verdict_wallets")
      .insert({ fingerprint_hash: fpHash, balance: 0 })
      .select()
      .single();
    wallet = created;
  }
  setCookie(FP_COOKIE, fpHash, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: FP_COOKIE_MAX_AGE,
    path: "/",
  });
  return { wallet, fingerprintHash: fpHash, ipHash };
}

function voteCost(n: number, mySideShare: number, participants: number): number {
  const base = Math.ceil(Math.pow(n, 1.6));
  const engagement = Math.min(2, 0.5 + participants / 30);
  const mult = 1 + (mySideShare - 0.5) * engagement;
  return Math.ceil(base * Math.max(0.5, mult));
}

// ---------- Public: read battle state ----------
export const getBattleState = createServerFn({ method: "POST" })
  .inputValidator((d: { postId: string; fingerprint?: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    if (!(await isEnabled(admin))) return { disabled: true as const };

    const { data: state } = await admin.rpc("get_battle_state", { _post_id: data.postId });
    const battle = Array.isArray(state) ? state[0] : state;
    if (!battle) return { battle: null };

    const { data: ticker } = await admin.rpc("get_battle_ticker", {
      _battle_id: battle.battle_id,
      _limit: 20,
    });

    let yourBalance: number | null = null;
    let yourVotesInBattle = 0;
    let yourKeepCost = 1;
    let yourRemoveCost = 1;
    if (data.fingerprint) {
      const { wallet } = await resolveWallet(admin, data.fingerprint);
      yourBalance = wallet.balance;
      const { count } = await admin
        .from("verdict_votes")
        .select("id", { count: "exact", head: true })
        .eq("battle_id", battle.battle_id)
        .eq("wallet_id", wallet.id);
      yourVotesInBattle = count ?? 0;
      const total = (battle.keep_credits ?? 0) + (battle.remove_credits ?? 0);
      const keepShare = total > 0 ? battle.keep_credits / total : 0.5;
      yourKeepCost = voteCost(yourVotesInBattle + 1, keepShare, battle.participant_count ?? 0);
      yourRemoveCost = voteCost(yourVotesInBattle + 1, 1 - keepShare, battle.participant_count ?? 0);
    }

    return { battle, ticker: ticker ?? [], yourBalance, yourVotesInBattle, yourKeepCost, yourRemoveCost };
  });

// ---------- Public: claim daily credits ----------
export const claimDailyCredits = createServerFn({ method: "POST" })
  .inputValidator((d: { fingerprint: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    if (!(await isEnabled(admin))) return { disabled: true as const };
    const { rateLimit } = await import("./verdict-abuse.server");
    const { wallet, ipHash } = await resolveWallet(admin, data.fingerprint);
    if (wallet.quarantined) return { error: "Wallet flagged. Contact support." };

    const last = wallet.last_daily_claim_at ? new Date(wallet.last_daily_claim_at).getTime() : 0;
    if (Date.now() - last < 23 * 3600 * 1000) {
      const nextAt = new Date(last + 24 * 3600 * 1000).toISOString();
      return { error: "Already claimed today", nextAt, balance: wallet.balance };
    }
    const ipGate = await rateLimit(admin, `claim:${ipHash}`, 24 * 3600, 3);
    if (!ipGate.ok) return { error: "Too many claims from this network." };

    const amount = await dailyClaimAmount(admin);
    const { data: updated } = await admin
      .from("verdict_wallets")
      .update({ balance: wallet.balance + amount, last_daily_claim_at: new Date().toISOString() })
      .eq("id", wallet.id)
      .select()
      .single();
    return { ok: true, balance: updated.balance, claimed: amount };
  });

// ---------- Public: get wallet ----------
export const getWallet = createServerFn({ method: "POST" })
  .inputValidator((d: { fingerprint: string }) => d)
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    if (!(await isEnabled(admin))) return { disabled: true as const };
    const { wallet } = await resolveWallet(admin, data.fingerprint);
    const canClaim = !wallet.last_daily_claim_at ||
      (Date.now() - new Date(wallet.last_daily_claim_at).getTime() >= 23 * 3600 * 1000);
    return { balance: wallet.balance, canClaim, quarantined: wallet.quarantined };
  });

// ---------- Public: cast vote ----------
export const castVote = createServerFn({ method: "POST" })
  .inputValidator((d: { battleId: string; side: "keep" | "remove"; fingerprint: string }) => {
    if (d.side !== "keep" && d.side !== "remove") throw new Error("Invalid side");
    return d;
  })
  .handler(async ({ data }) => {
    const admin = await loadAdmin();
    if (!(await isEnabled(admin))) return { disabled: true as const };

    const { rateLimit, hashIp, extractIp } = await import("./verdict-abuse.server");
    const ip = extractIp(getRequest());
    const ipHash = hashIp(ip);
    const ipGate = await rateLimit(admin, `vote:${ipHash}`, 60, 30);
    if (!ipGate.ok) return { error: "Slow down — too many votes from this network." };

    const { wallet } = await resolveWallet(admin, data.fingerprint);
    if (wallet.quarantined) return { error: "Wallet flagged." };

    const { data: battle } = await admin
      .from("verdict_battles")
      .select("*")
      .eq("id", data.battleId)
      .maybeSingle();
    if (!battle || battle.status !== "live") return { error: "Battle is not live." };

    // Determine vote_n & cost
    const { count: existingVotes } = await admin
      .from("verdict_votes")
      .select("id", { count: "exact", head: true })
      .eq("battle_id", battle.id)
      .eq("wallet_id", wallet.id);
    const n = (existingVotes ?? 0) + 1;
    const total = battle.keep_credits + battle.remove_credits;
    const mySideTotal = data.side === "keep" ? battle.keep_credits : battle.remove_credits;
    const mySideShare = total > 0 ? mySideTotal / total : 0.5;
    const cost = voteCost(n, mySideShare, battle.participant_count);

    if (wallet.balance < cost) return { error: "Not enough credits.", needed: cost, balance: wallet.balance };

    // Charge wallet
    await admin
      .from("verdict_wallets")
      .update({ balance: wallet.balance - cost })
      .eq("id", wallet.id);

    // Insert vote
    await admin.from("verdict_votes").insert({
      battle_id: battle.id,
      wallet_id: wallet.id,
      fingerprint_hash: wallet.fingerprint_hash,
      ip_hash: ipHash,
      side: data.side,
      credits: cost,
      vote_n: n,
      cost_charged: cost,
    });

    // Update battle tallies
    const newKeep = battle.keep_credits + (data.side === "keep" ? cost : 0);
    const newRemove = battle.remove_credits + (data.side === "remove" ? cost : 0);
    const newLeadSide = newKeep > newRemove ? "keep" : newKeep < newRemove ? "remove" : null;
    const leadSinceUpdate = battle.current_lead_side !== newLeadSide
      ? new Date().toISOString()
      : battle.lead_since;

    // Bump participant count if first vote for this wallet
    const isNewParticipant = n === 1;
    const newParticipants = battle.participant_count + (isNewParticipant ? 1 : 0);

    await admin
      .from("verdict_battles")
      .update({
        keep_credits: newKeep,
        remove_credits: newRemove,
        current_lead_side: newLeadSide,
        lead_since: leadSinceUpdate,
        participant_count: newParticipants,
      })
      .eq("id", battle.id);

    // Check win condition
    if (newLeadSide) {
      const lead = Math.abs(newKeep - newRemove);
      const leadHeldMs = leadSinceUpdate ? Date.now() - new Date(leadSinceUpdate).getTime() : 0;
      if (lead >= battle.lead_threshold && leadHeldMs >= battle.momentum_window_sec * 1000) {
        await resolveBattle(admin, battle.id, newLeadSide);
      }
    }
    // Ceiling check
    if (new Date(battle.ends_at).getTime() <= Date.now()) {
      await resolveBattle(admin, battle.id, newLeadSide ?? "keep");
    }

    // Trigger ghosts in background (non-blocking semantics — await but cheap)
    try {
      const { tickGhosts } = await import("./verdict-ghost.server");
      await tickGhosts(admin, battle.id);
    } catch { /* ignore */ }

    return { ok: true, charged: cost, balance: wallet.balance - cost, side: data.side };
  });

async function resolveBattle(admin: any, battleId: string, winner: "keep" | "remove") {
  const { data: battle } = await admin
    .from("verdict_battles").select("*").eq("id", battleId).maybeSingle();
  if (!battle || battle.status !== "live") return;

  await admin.from("verdict_battles")
    .update({ status: "decided", winner, decided_at: new Date().toISOString() })
    .eq("id", battleId);

  // Victory dividend — 10% of credits spent on winning side, rounded up
  const { data: winnerVotes } = await admin
    .from("verdict_votes")
    .select("wallet_id, cost_charged")
    .eq("battle_id", battleId)
    .eq("side", winner)
    .eq("is_ghost", false);
  const byWallet: Record<string, number> = {};
  for (const v of (winnerVotes ?? []) as any[]) {
    if (!v.wallet_id) continue;
    byWallet[v.wallet_id] = (byWallet[v.wallet_id] ?? 0) + v.cost_charged;
  }
  for (const [wId, spent] of Object.entries(byWallet)) {
    const dividend = Math.ceil(spent * 0.1);
    if (dividend <= 0) continue;
    const { data: w } = await admin.from("verdict_wallets").select("balance,lifetime_earned").eq("id", wId).maybeSingle();
    if (!w) continue;
    await admin.from("verdict_wallets")
      .update({ balance: w.balance + dividend, lifetime_earned: w.lifetime_earned + dividend })
      .eq("id", wId);
  }

  // Apply outcome to post
  if (winner === "remove") {
    const { data: post } = await admin.from("posts").select("body,dek,title").eq("id", battle.post_id).maybeSingle();
    if (post) {
      await admin.from("posts").update({
        status: "community_removed",
        removed_snapshot: { body: post.body, dek: post.dek, title: post.title, removed_at: new Date().toISOString() },
      }).eq("id", battle.post_id);
    }
  }
}

// ---------- Admin ----------
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminToggleControversial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; value: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    await admin.from("posts").update({ is_controversial: data.value }).eq("id", data.postId);
    return { ok: true };
  });

export const adminOpenBattle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string; ghostMode?: "off" | "subtle" | "aggressive" }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const { data: existing } = await admin
      .from("verdict_battles").select("id").eq("post_id", data.postId).eq("status", "live").maybeSingle();
    if (existing) return { ok: true, battleId: existing.id, alreadyOpen: true };
    const { data: created } = await admin
      .from("verdict_battles")
      .insert({ post_id: data.postId, ghost_mode: data.ghostMode ?? "subtle" })
      .select().single();
    return { ok: true, battleId: created.id };
  });

export const adminRestorePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const { data: post } = await admin.from("posts")
      .select("removed_snapshot").eq("id", data.postId).maybeSingle();
    const snap = post?.removed_snapshot ?? null;
    await admin.from("posts").update({
      status: "published",
      removed_snapshot: null,
      ...(snap?.body ? { body: snap.body } : {}),
      ...(snap?.dek ? { dek: snap.dek } : {}),
      ...(snap?.title ? { title: snap.title } : {}),
    }).eq("id", data.postId);
    // Cancel any live battle
    await admin.from("verdict_battles")
      .update({ status: "cancelled" }).eq("post_id", data.postId).eq("status", "live");
    return { ok: true };
  });

export const adminListBattles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const admin = await loadAdmin();
    const { data } = await admin
      .from("verdict_battles")
      .select("id, post_id, status, winner, keep_credits, remove_credits, participant_count, ghost_mode, opened_at, decided_at")
      .order("opened_at", { ascending: false })
      .limit(100);
    return { battles: data ?? [] };
  });
