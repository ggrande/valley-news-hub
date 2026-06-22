
CREATE TYPE public.closing_type AS ENUM ('school','government','business','other');
CREATE TYPE public.closing_status AS ENUM ('closed','delayed','early_dismissal','virtual','normal');

CREATE TABLE public.closings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  type public.closing_type NOT NULL DEFAULT 'school',
  status public.closing_status NOT NULL DEFAULT 'closed',
  county text,
  note text,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.closings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closings TO authenticated;
GRANT ALL ON public.closings TO service_role;

ALTER TABLE public.closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active closings"
  ON public.closings FOR SELECT
  USING (effective_date <= CURRENT_DATE AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Admins can manage closings"
  ON public.closings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER set_closings_updated_at
  BEFORE UPDATE ON public.closings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX closings_effective_date_idx ON public.closings (effective_date DESC);
CREATE INDEX closings_county_idx ON public.closings (county);
