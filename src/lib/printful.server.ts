// Printful API v1 client. Server-only.
// Docs: https://developers.printful.com/docs/

const BASE = "https://api.printful.com";

function getKey(): string {
  const k = process.env.PRINTFUL_API_KEY;
  if (!k) throw new Error("PRINTFUL_API_KEY is not configured");
  return k;
}

async function pf<T = any>(path: string, init?: RequestInit): Promise<T> {
  const storeId = process.env.PRINTFUL_STORE_ID;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
      ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.result || text || `Printful ${res.status}`;
    throw new Error(`Printful API ${res.status}: ${msg}`);
  }
  return body?.result ?? body;
}

export type PrintfulSyncProductListItem = {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string;
  is_ignored: boolean;
};

export type PrintfulSyncVariant = {
  id: number; // sync_variant id (use this on /orders)
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number; // catalog variant id
  retail_price: string; // e.g. "24.99"
  currency: string;
  product: { variant_id: number; product_id: number; image: string; name: string };
  files: Array<{ id: number; type: string; preview_url?: string; thumbnail_url?: string }>;
};

export type PrintfulSyncProductDetail = {
  sync_product: PrintfulSyncProductListItem;
  sync_variants: PrintfulSyncVariant[];
};

export async function listSyncProducts(): Promise<PrintfulSyncProductListItem[]> {
  return await pf<PrintfulSyncProductListItem[]>("/store/products?status=all&limit=100");
}

export async function getSyncProduct(id: number | string): Promise<PrintfulSyncProductDetail> {
  return await pf<PrintfulSyncProductDetail>(`/store/products/${id}`);
}

export type PrintfulRecipient = {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  zip: string;
  email?: string;
  phone?: string;
};

export type CreateOrderInput = {
  external_id: string;
  recipient: PrintfulRecipient;
  items: Array<{ sync_variant_id: number; quantity: number; retail_price?: string }>;
  confirm?: boolean;
};

export async function createOrder(input: CreateOrderInput): Promise<{ id: number; status: string }> {
  const confirm = input.confirm ?? false;
  return await pf(`/orders?confirm=${confirm ? "true" : "false"}`, {
    method: "POST",
    body: JSON.stringify({
      external_id: input.external_id,
      recipient: input.recipient,
      items: input.items.map((i) => ({
        sync_variant_id: i.sync_variant_id,
        quantity: i.quantity,
        ...(i.retail_price && { retail_price: i.retail_price }),
      })),
    }),
  });
}
