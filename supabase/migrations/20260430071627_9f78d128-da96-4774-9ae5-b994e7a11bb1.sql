-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Storage bucket for uploaded rules PDFs (private, admin-managed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rules-pdfs', 'rules-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only admins can read/write rules PDFs
CREATE POLICY "Admins can read rules pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload rules pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update rules pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete rules pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

-- Sources: one row per uploaded PDF
CREATE TABLE public.rules_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  label text NOT NULL,
  filename text NOT NULL,
  page_count integer,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | ready | error
  error text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rules_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rules sources"
ON public.rules_sources FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage rules sources"
ON public.rules_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rules_sources_updated_at
BEFORE UPDATE ON public.rules_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chunks: embedded passages
CREATE TABLE public.rules_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.rules_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_start integer,
  page_end integer,
  section text,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rules_chunks ENABLE ROW LEVEL SECURITY;

-- Public read so the chat edge function can query without service role.
-- Content is non-sensitive (official rules). Writes are admin-only.
CREATE POLICY "Anyone can read rules chunks"
ON public.rules_chunks FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage rules chunks"
ON public.rules_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX rules_chunks_source_idx ON public.rules_chunks(source_id);
CREATE INDEX rules_chunks_embedding_idx ON public.rules_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Faction data proposals: regenerate-factions output for review/apply
CREATE TABLE public.faction_data_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal jsonb NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- pending | applied | discarded
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faction_data_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage faction proposals"
ON public.faction_data_proposals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RPC: top-k semantic search
CREATE OR REPLACE FUNCTION public.match_rules_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_label text,
  page_start int,
  page_end int,
  section text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.source_id, s.label AS source_label,
         c.page_start, c.page_end, c.section, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rules_chunks c
  JOIN public.rules_sources s ON s.id = c.source_id
  WHERE s.status = 'ready' AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;