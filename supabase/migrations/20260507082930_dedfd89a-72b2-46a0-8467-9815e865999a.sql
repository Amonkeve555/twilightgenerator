CREATE TABLE public.map_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.map_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
ON public.map_templates FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
ON public.map_templates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.map_templates FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.map_templates FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_map_templates_updated_at
BEFORE UPDATE ON public.map_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_map_templates_user ON public.map_templates(user_id, updated_at DESC);