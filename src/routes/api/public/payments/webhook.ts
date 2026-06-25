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

async function handleMerchCheckoutCompleted(session: any, env: StripeEnv) {
  const supabase = getSupabase();
  const syncVariantId = Number(session.metadata?.printful_sync_variant_id);
  const quantity = Number(session.metadata?.quantity) || 1;
  const email = session.customer_details?.email || session.customer_email || "";
  const userId = session.metadata?.userId || null;
  const shipping = session.collected_information?.shipping_details
    || session.customer_details?.address
    || null;
  const lineItem = session.display_items?.[0] || null;
  const productName = lineItem?.custom?.name || session.payment_intent?.description || "Merch order";

  const items = [{ sync_variant_id: syncVariantId, quantity, name: productName }];

  // Insert order row first (so we have a trail even if Printful fails)
  const { data: inserted } = await supabase
    .from("merch_orders")
    .upsert({
      user_id: userId,
      email,
      stripe_session_id: session.id,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      status: "pending",
      amount_cents: session.amount_total ?? null,
      currency: session.currency ?? "usd",
      items,
      shipping_address: shipping,
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_session_id" })
    .select()
    .single();

  // Submit to Printful
  const sd = session.collected_information?.shipping_details || session.shipping_details || {};
  const addr = sd.address || session.customer_details?.address || {};
  const recipient = {
    name: sd.name || session.customer_details?.name || email,
    address1: addr.line1,
    address2: addr.line2 || undefined,
    city: addr.city,
    state_code: addr.state,
    country_code: addr.country,
    zip: addr.postal_code,
    email,
    phone: session.customer_details?.phone || undefined,
  };

  if (!recipient.address1 || !recipient.city || !recipient.country_code || !recipient.zip || !syncVariantId) {
    await supabase.from("merch_orders").update({
      status: "submit_failed",
      error: "Missing shipping address or variant id",
    }).eq("id", (inserted as any).id);
    return;
  }

  try {
    const { createOrder } = await import("@/lib/printful.server");
    const result = await createOrder({
      external_id: session.id,
      recipient: recipient as any,
      items: [{ sync_variant_id: syncVariantId, quantity }],
      confirm: env === "live", // only auto-fulfill in production
    });
    await supabase.from("merch_orders").update({
      status: "submitted",
      printful_order_id: String(result.id),
      error: null,
    }).eq("id", (inserted as any).id);
  } catch (e: any) {
    await supabase.from("merch_orders").update({
      status: "submit_failed",
      error: String(e?.message || e).slice(0, 1000),
    }).eq("id", (inserted as any).id);
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  if (session.metadata?.kind === "merch") {
    await handleMerchCheckoutCompleted(session, env);
    return;
  }
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

async function handleInvoiceEvent(invoice: any, env: StripeEnv, type: string) {
  const subId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id ?? null;
  if (!subId) return;
  const supabase = getSupabase();
  const status = type === "invoice.payment_failed" ? "past_due" : "active";
  await supabase
    .from("network_purchases")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId)
    .eq("environment", env);
  await supabase
    .from("managed_sites")
    .update({ subscription_status: status, updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subId);
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
    case "invoice.payment_failed":
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoiceEvent(event.data.object, env, event.type);
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
