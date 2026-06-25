
CREATE TABLE public.merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  stripe_session_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  printful_order_id text,
  status text NOT NULL DEFAULT 'pending',
  amount_cents integer,
  currency text DEFAULT 'usd',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  shipping_address jsonb,
  tracking_url text,
  environment text NOT NULL DEFAULT 'sandbox',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_merch_orders_user ON public.merch_orders(user_id);
CREATE INDEX idx_merch_orders_status ON public.merch_orders(status);

GRANT SELECT ON public.merch_orders TO authenticated;
GRANT ALL ON public.merch_orders TO service_role;

ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own merch orders"
  ON public.merch_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Service role manages merch orders"
  ON public.merch_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_merch_orders_updated_at
  BEFORE UPDATE ON public.merch_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
