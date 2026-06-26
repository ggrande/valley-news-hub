// Ghost contributor engine — drips fake votes into live battles so the rope
// always feels alive. Real money never depends on ghosts unless
// verdict_ghost_can_decide is on.

export async function tickGhosts(supabaseAdmin: any, battleId: string): Promise<number> {
  const { data: battle } = await supabaseAdmin
    .from("verdict_battles")
    .select("id, status, ghost_mode, keep_credits, remove_credits, participant_count")
    .eq("id", battleId)
    .maybeSingle();
  if (!battle || battle.status !== "live" || battle.ghost_mode === "off") return 0;

  const intensity = battle.ghost_mode === "aggressive" ? 4 : 2;
  // Taper as real participants join
  const realPct = Math.min(1, (battle.participant_count ?? 0) / 25);
  const ghostsToDrip = Math.max(1, Math.round(intensity * (1 - realPct)));

  const { data: personas } = await supabaseAdmin
    .from("ghost_personas")
    .select("handle, bias, frequency, size_min, size_max")
    .eq("active", true);
  if (!personas?.length) return 0;

  const total = battle.keep_credits + battle.remove_credits;
  const keepShare = total > 0 ? battle.keep_credits / total : 0.5;

  let dripped = 0;
  for (let i = 0; i < ghostsToDrip; i++) {
    const p = personas[Math.floor(Math.random() * personas.length)];
    if (Math.random() > p.frequency) continue;
    // Bandwagon ghosts (bias positive=remove) lean toward leader; contrarians vs.
    const baseProb = 0.5 + p.bias * 0.5; // 0..1 prob of "remove"
    // Slight bandwagon pull toward currently leading side
    const leaderPull = (1 - keepShare) - 0.5; // positive when remove leads
    const pRemove = Math.max(0.05, Math.min(0.95, baseProb + leaderPull * 0.2));
    const side = Math.random() < pRemove ? "remove" : "keep";
    const credits = Math.max(1, Math.floor(p.size_min + Math.random() * (p.size_max - p.size_min + 1)));

    await supabaseAdmin.from("verdict_votes").insert({
      battle_id: battleId,
      side,
      credits,
      vote_n: 1,
      cost_charged: credits,
      is_ghost: true,
      ghost_handle: p.handle,
    });
    // Bump tallies only when ghost_can_decide is on
    const { data: setting } = await supabaseAdmin
      .from("site_settings").select("value").eq("key", "verdict_ghost_can_decide").maybeSingle();
    const canDecide = setting?.value === true;
    if (canDecide) {
      const field = side === "keep" ? "keep_credits" : "remove_credits";
      await supabaseAdmin.rpc("noop").catch(() => {});
      await supabaseAdmin
        .from("verdict_battles")
        .update({ [field]: (battle as any)[field] + credits })
        .eq("id", battleId);
      (battle as any)[field] += credits;
    }
    dripped++;
  }
  return dripped;
}
