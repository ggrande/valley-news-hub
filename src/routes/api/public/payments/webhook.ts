import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

function generateLicenseKey(): string {
  // WKNA49-XXXX-XXXX-XXXX-XXXX (cryptographically random)
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `WKNA49-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 20)}`;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const tier = session.metadata?.tier as "self_host_license" | "managed_mirror" | undefined;
  if (!tier) return;

  const email = session.customer_details?.email || session.customer_email || "";
  const supabase = getSupabase();

  const { data: purchase } = await supabase
    .from("network_purchases")
    .upsert(
      {
        user_id: session.metadata?.userId ?? null,
        tier,
        email,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
        stripe_session_id: session.id,
        stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
        status: "completed",
        environment: env,
        amount_cents: session.amount_total ?? null,
        currency: session.currency ?? "usd",
        metadata: { mode: session.mode },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_session_id" },
    )
    .select()
    .single();

  if (tier === "self_host_license" && purchase) {
    const { data: existing } = await supabase
      .from("licenses")
      .select("id")
      .eq("purchase_id", (purchase as any).id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("licenses").insert({
        purchase_id: (purchase as any).id,
        license_key: generateLicenseKey(),
        email,
        channel: "stable",
      });
    }
  }

  if (tier === "managed_mirror" && purchase) {
    // Provision a managed site if one doesn't exist for this subscription yet
    const subId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
    if (subId) {
      const { data: existingSite } = await supabase
        .from("managed_sites")
        .select("id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      if (!existingSite) {
        // Generate a unique subdomain slug from email local-part
        const base = (email.split("@")[0] || "site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "site";
        let subdomain = base;
        for (let i = 0; i < 5; i++) {
          const { data: clash } = await supabase
            .from("managed_sites").select("id").eq("subdomain", subdomain).maybeSingle();
          if (!clash) break;
          subdomain = `${base}-${Math.random().toString(36).slice(2, 6)}`;
        }
        await supabase.from("managed_sites").insert({
          owner_user_id: session.metadata?.userId ?? null,
          owner_email: email,
          purchase_id: (purchase as any).id,
          stripe_subscription_id: subId,
          subdomain,
          display_name: "My News Site",
          status: "pending_provision",
          subscription_status: "active",
        });
      }
    }
  }
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const supabase = getSupabase();
  await supabase
    .from("network_purchases")
    .update({ status: subscription.status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  // Mirror subscription_status onto managed_sites so we can gate access
  await supabase
    .from("managed_sites")
    .update({ subscription_status: subscription.status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook with invalid env:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv as StripeEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
