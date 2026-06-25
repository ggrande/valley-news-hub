# Printful Merch Store

A `/merch` section that pulls products from your Printful store, sells them through the existing Stripe Checkout flow, collects shipping addresses, and auto-submits orders to Printful for fulfillment via webhook.

## Honest note on MCP

No major POD vendor (Printful, Printify, Gelato) ships an MCP server today. We'll integrate Printful's REST API directly — it's well-documented and clean. Total moving parts are small.

## What you need to do in Printful (15–20 min, in parallel with my build)

1. Sign up at printful.com (free).
2. **Create a Printful "Store"** of type *Manual Order Platform / API*. This gives products stable `sync_product` IDs we can list.
3. In that store, add each product (t-shirt, tumbler, sticker, car magnet, bandana). For each: pick the blank, upload your WKNA logo/design, set your retail price, save. Printful generates mockup images automatically.
4. Generate a **Private API token** (Settings → Developers → API Tokens) with scopes: `products:read`, `orders:read`, `orders:write`, `webhooks:read`, `webhooks:write`.
5. Hand me the API token — I'll store it as `PRINTFUL_API_KEY`.

While you do that, I'll build everything below so it works the moment the token lands.

## Architecture

```text
Browser → /merch (list)         ← server fn: list products (cached) ← Printful /store/products
       → /merch/$id (detail)    ← server fn: get variants            ← Printful /store/products/{id}
       → Stripe Embedded Checkout (existing flow, extended)
            • shipping_address_collection: US + CA
            • line_item with price_data (dynamic, set from Printful retail price)
            • automatic_tax: enabled  (NOT managed_payments — physical goods)
            • metadata: { kind: "merch", printful_variant_id, quantity }
       → /api/public/payments/webhook (existing)
            • new branch: checkout.session.completed where metadata.kind === "merch"
            • POST Printful /orders with recipient + items + external_id = session.id
            • Store row in `merch_orders` table for the customer to see in /account/orders
```

## Files to create

- `src/lib/printful.server.ts` — thin Printful API client (fetch wrapper, auth header, error parsing).
- `src/lib/merch.functions.ts` — `listMerchProducts`, `getMerchProduct(id)`, `createMerchCheckoutSession({ variantId, quantity })` server fns.
- `src/routes/merch.tsx` — grid of products with mockup + price.
- `src/routes/merch.$id.tsx` — product detail with variant picker (size/color) and "Buy now" → opens existing `useStripeCheckout` with dynamic `price_data`.
- `src/routes/_authenticated/account.orders.tsx` — customer order history (status, tracking link from Printful).
- `src/routes/_authenticated/admin.merch.tsx` — admin view of all orders + manual "Resync from Printful" button + "Retry submit" for failed webhook submissions.
- `supabase/migrations/<ts>_merch_orders.sql` — `merch_orders` table (id, user_id, stripe_session_id, printful_order_id, status, amount_cents, items jsonb, shipping jsonb, environment, created_at, updated_at, error). RLS: user sees own; admin sees all; service_role full.

## Files to modify

- `src/lib/network-payments.functions.ts` — add `createMerchCheckoutSession` (uses `price_data` since Printful prices change; collects shipping address; sets `automatic_tax: { enabled: true }` instead of `managed_payments`).
- `src/routes/api/public/payments/webhook.ts` — add `checkout.session.completed` branch: when `metadata.kind === "merch"`, retrieve full session (with `customer_details.address`), POST to Printful `/orders` with `confirm: true` (auto-fulfill), insert `merch_orders` row. On Printful failure, insert row with `status: "submit_failed"` + error so admin can retry.
- `src/components/site/Header.tsx` — add "Merch" link.
- `src/components/site/Footer.tsx` — add "Merch" + "My Orders" links.

## Tax & compliance

Physical goods — `managed_payments` is digital-only. We use `automatic_tax: { enabled: true }` (+0.5%). You handle filing. Each Printful product type gets a Stripe tax code (apparel = `txcd_30011000`, drinkware = `txcd_99999999`, stickers/magnets = `txcd_99999999`). I'll set these on a one-off Stripe Product (`product_data` inside `price_data`) per checkout — no Stripe product catalog needed since pricing is dynamic from Printful.

## Stripe vs Printful price source-of-truth

You set retail prices in **Printful** (single place to edit). At checkout, we fetch the live Printful retail price for the variant and pass it as `price_data.unit_amount` to Stripe. No drift, no double bookkeeping.

## Shipping

Stripe collects address → we pass it to Printful → Printful calculates actual shipping cost and charges *you* (the merchant). For v1, we set a flat shipping rate in Stripe (`shipping_options`, e.g. $5.99 US). Real shipping calculation (call Printful `/shipping/rates` mid-checkout) is a v2 polish — skip for the 1-hour goal.

## Test plan

1. Create one cheap test product in Printful (sticker, ~$3).
2. In preview, visit `/merch`, click sticker, "Buy now".
3. Use `4242 4242 4242 4242`, real-looking US address.
4. Confirm in Stripe sandbox dashboard: session completed, charge succeeded.
5. Confirm in Printful dashboard: new draft order appears (we'll set `confirm: false` in sandbox so test orders don't actually print).
6. Check `/account/orders` shows the order.
7. Flip `confirm` to `true` only in live env.

## What's out of scope (call out so we don't over-build)

- Live shipping rate calculation (flat rate for v1).
- Cart with multiple items (one-item-per-checkout for v1; add cart later if needed).
- Refund automation (handle manually in Stripe + Printful for v1).
- Inventory sync (Printful handles stock; we just hide out-of-stock variants on fetch).

## Time estimate

~45–60 min of build once you give me the Printful API token. The Printful account setup + product creation on your end is the gating step.
