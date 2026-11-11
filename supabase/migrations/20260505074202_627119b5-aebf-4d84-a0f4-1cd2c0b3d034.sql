CREATE TABLE public.faction_data_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_name text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_by uuid,
  applied_from_proposal uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faction_data_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read faction overrides"
ON public.faction_data_overrides FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage faction overrides"
ON public.faction_data_overrides FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_faction_overrides_updated_at
BEFORE UPDATE ON public.faction_data_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();