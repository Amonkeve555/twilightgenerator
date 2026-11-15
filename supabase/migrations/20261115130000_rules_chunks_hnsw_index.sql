-- The ivfflat index (lists = 50) made match_rules_chunks probe only 1 of 50
-- lists by default, so each query searched ~2% of chunks and missed relevant
-- rules. HNSW keeps high recall without tuning probes and can be built on an
-- empty or small table.
DROP INDEX IF EXISTS public.rules_chunks_embedding_idx;

CREATE INDEX rules_chunks_embedding_idx ON public.rules_chunks
  USING hnsw (embedding vector_cosine_ops);
