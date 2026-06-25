import { createServerFn } from "@tanstack/react-start";

type Tier = "merch";
type CheckoutResult = { clientSecret: string } | { error: string };

export type MerchListItem = {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: number;
  min_price?: string;
  currency?: string;
};

export type MerchDetail = {
  id: number;
  name: string;
  thumbnail_url: string;
  variants: Array<{
    id: number;
    name: string;
    retail_price: string;
    currency: string;
    image: string;
    available: boolean;
  }>;
};

export const listMerchProducts = createServerFn({ method: "GET" }).handler(async (): Promise<MerchListItem[]> => {
  const { listSyncProducts, getSyncProduct } = await import("./printful.server");
  const products = await listSyncProducts();
  const visible = products.filter((p) => !p.is_ignored && p.synced > 0);
  // Fetch first variant for each to surface a starting price (cheap parallel calls).
  const enriched = await Promise.all(
    visible.map(async (p) => {
      try {
        const detail = await getSyncProduct(p.id);
        const prices = detail.sync_variants
          .filter((v) => v.synced)
          .map((v) => Number(v.retail_price))
          .filter((n) => !Number.isNaN(n));
        const min = prices.length ? Math.min(...prices).toFixed(2) : undefined;
        const cur = detail.sync_variants[0]?.currency ?? "USD";
        return {
          id: p.id,
          name: p.name,
          thumbnail_url: p.thumbnail_url,
          variants: p.variants,
          min_price: min,
          currency: cur,
        } satisfies MerchListItem;
      } catch {
        return { id: p.id, name: p.name, thumbnail_url: p.thumbnail_url, variants: p.variants } satisfies MerchListItem;
      }
    }),
  );
  return enriched;
});

export const getMerchProduct = createServerFn({ method: "GET" })
  .inputValidator((data: { id: number }) => {
    if (!Number.isFinite(data.id) || data.id <= 0) throw new Error("Invalid product id");
    return data;
  })
  .handler(async ({ data }): Promise<MerchDetail> => {
    const { getSyncProduct } = await import("./printful.server");
    const detail = await getSyncProduct(data.id);
    return {
      id: detail.sync_product.id,
      name: detail.sync_product.name,
      thumbnail_url: detail.sync_product.thumbnail_url,
      variants: detail.sync_variants
        .filter((v) => v.synced)
        .map((v) => ({
          id: v.id,
          name: v.name,
          retail_price: v.retail_price,
          currency: v.currency,
          image: v.files?.find((f) => f.type === "preview")?.preview_url
            || v.files?.[0]?.preview_url
            || v.product?.image
            || detail.sync_product.thumbnail_url,
          available: true,
        })),
    };
  });

export const createMerchCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: {
    syncVariantId: number;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    image?: string;
    customerEmail?: string;
    userId?: string;
    returnUrl: string;
    environment: "sandbox" | "live";
  }) => {
    if (!Number.isFinite(data.syncVariantId) || data.syncVariantId <= 0) throw new Error("Invalid variant");
    if (!Number.isFinite(data.unitPriceCents) || data.unitPriceCents < 100) throw new Error("Invalid price");
    if (!Number.isFinite(data.quantity) || data.quantity < 1 || data.quantity > 10) throw new Error("Invalid qty");
    if (!data.productName || data.productName.length > 200) throw new Error("Invalid product name");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        line_items: [{
          quantity: data.quantity,
          price_data: {
            currency: "usd",
            unit_amount: data.unitPriceCents,
            product_data: {
              name: data.productName,
              ...(data.image && { images: [data.image] }),
              tax_code: "txcd_30011000", // general apparel/physical goods fallback
            },
          },
        }],
        // Flat shipping for v1.
        shipping_options: [{
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Standard shipping",
            fixed_amount: { amount: 599, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 5 },
              maximum: { unit: "business_day", value: 10 },
            },
          },
        }],
        shipping_address_collection: { allowed_countries: ["US", "CA"] },
        automatic_tax: { enabled: true },
        phone_number_collection: { enabled: true },
        ...(data.customerEmail && { customer_email: data.customerEmail }),
        payment_intent_data: { description: data.productName },
        metadata: {
          kind: "merch",
          printful_sync_variant_id: String(data.syncVariantId),
          quantity: String(data.quantity),
          ...(data.userId && { userId: data.userId }),
        },
      } as any);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
