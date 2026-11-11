// Ingest a rules PDF: extract text per page, chunk it, embed each chunk,
// and insert rows into public.rules_chunks. Updates rules_sources status.
// Triggered by the client right after upload.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const EMBED_MODEL = "gemini-embedding-001"; // 768 dims with outputDimensionality
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

const TARGET_CHARS = 2400; // ~600 tokens
const OVERLAP_CHARS = 300;

async function extractPagesText(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  // unpdf returns string[] when mergePages: false
  const pages = (Array.isArray(text) ? text : [text as string]).map((t) =>
    (t ?? "").replace(/\s+/g, " ").trim()
  );
  return pages;
}

interface Chunk {
  content: string;
  page_start: number;
  page_end: number;
  section?: string;
}

function chunkPages(pages: string[]): Chunk[] {
  // Build a flat string with page markers, then slide a window.
  const markers: { pos: number; page: number }[] = [];
  let combined = "";
  pages.forEach((text, idx) => {
    markers.push({ pos: combined.length, page: idx + 1 });
    combined += (combined ? "\n\n" : "") + text;
  });
  if (!combined.trim()) return [];

  const pageAt = (pos: number): number => {
    let p = 1;
    for (const m of markers) {
      if (m.pos <= pos) p = m.page;
      else break;
    }
    return p;
  };

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < combined.length) {
    const end = Math.min(combined.length, start + TARGET_CHARS);
    // try to break on sentence boundary near end
    let cut = end;
    if (end < combined.length) {
      const slice = combined.slice(start, end);
      const lastPeriod = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("\n"),
      );
      if (lastPeriod > TARGET_CHARS * 0.6) cut = start + lastPeriod + 1;
    }
    const content = combined.slice(start, cut).trim();
    if (content.length > 50) {
      chunks.push({
        content,
        page_start: pageAt(start),
        page_end: pageAt(cut - 1),
      });
    }
    if (cut >= combined.length) break;
    start = Math.max(cut - OVERLAP_CHARS, cut);
  }
  return chunks;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
  const out: number[][] = [];
  for (const text of texts) {
    let attempt = 0;
    while (true) {
      const r = await fetch(`${EMBED_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        }),
      });
      if (r.ok) {
        const json = await r.json();
        out.push(json.embedding.values as number[]);
        // Throttle: free tier ~5 RPM => ~13s between calls. Use 13s to be safe.
        await new Promise((res) => setTimeout(res, 13000));
        break;
      }
      const t = await r.text();
      if (r.status === 429 && attempt < 5) {
        attempt++;
        const wait = 30000 * attempt; // 30s, 60s, 90s, ...
        console.warn(`429 from embed, waiting ${wait}ms (attempt ${attempt})`);
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      throw new Error(`Embed failed [${r.status}]: ${t}`);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const sourceId: string | undefined = body.source_id;
    if (!sourceId) {
      return new Response(JSON.stringify({ error: "source_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: src, error: srcErr } = await admin
      .from("rules_sources")
      .select("*")
      .eq("id", sourceId)
      .single();
    if (srcErr || !src) {
      return new Response(JSON.stringify({ error: "source_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("rules_sources")
      .update({ status: "processing", error: null })
      .eq("id", sourceId);

    // Wipe any prior chunks (re-ingest)
    await admin.from("rules_chunks").delete().eq("source_id", sourceId);

    // Download
    const dl = await admin.storage.from("rules-pdfs").download(src.storage_path);
    if (dl.error || !dl.data) {
      const msg = dl.error?.message ?? "download failed";
      await admin.from("rules_sources").update({ status: "error", error: msg }).eq("id", sourceId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let pages: string[];
    try {
      pages = await extractPagesText(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("rules_sources").update({ status: "error", error: `pdf_parse: ${msg}` }).eq("id", sourceId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      await admin.from("rules_sources").update({
        status: "error",
        error: "No extractable text. Is this a scanned PDF? OCR is not supported.",
        page_count: pages.length,
      }).eq("id", sourceId);
      return new Response(JSON.stringify({ error: "no_text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Embed in batches of 16
    const BATCH = 16;
    let inserted = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vecs = await embedBatch(slice.map((c) => c.content));
      const rows = slice.map((c, j) => ({
        source_id: sourceId,
        chunk_index: i + j,
        page_start: c.page_start,
        page_end: c.page_end,
        section: c.section ?? null,
        content: c.content,
        // pgvector accepts the array as a string literal "[...]"
        embedding: `[${vecs[j].join(",")}]`,
      }));
      const { error: insErr } = await admin.from("rules_chunks").insert(rows);
      if (insErr) {
        await admin.from("rules_sources").update({
          status: "error",
          error: `insert: ${insErr.message}`,
        }).eq("id", sourceId);
        throw insErr;
      }
      inserted += rows.length;
    }

    await admin.from("rules_sources").update({
      status: "ready",
      error: null,
      page_count: pages.length,
      chunk_count: inserted,
    }).eq("id", sourceId);

    return new Response(JSON.stringify({
      success: true,
      pages: pages.length,
      chunks: inserted,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-rules-pdf error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
