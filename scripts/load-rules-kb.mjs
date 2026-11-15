// Load curated rules-knowledge chunks (supabase/rules_kb/*.json) into
// rules_sources / rules_chunks, embedding them with Gemini.
//
// The PDF upload path (ingest-rules-pdf) works on raw page text; these chunks are
// hand-curated instead (sections split by rule heading, unit stats transcribed
// from the faction-sheet images). Rebuild the JSON with supabase/rules_kb/build_chunks.py.
//
// Usage (keys are NOT stored in the repo):
//   SUPABASE_SERVICE_ROLE_KEY=... GEMINI_API_KEY=... node scripts/load-rules-kb.mjs [--dry-run]
// SUPABASE_URL defaults to VITE_SUPABASE_URL from .env.production.

import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const KB_DIR = new URL("../supabase/rules_kb/", import.meta.url);
const EMBED_MODEL = "gemini-embedding-001";
const DIMS = 768; // must match rules_chunks.embedding vector(768)

function envFromFile(path, key) {
  try {
    const line = readFileSync(new URL(path, import.meta.url), "utf8")
      .split("\n")
      .find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim().replace(/^"|"$/g, "");
  } catch {
    return undefined;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? envFromFile("../.env.production", "VITE_SUPABASE_URL");
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Group chunks by source label; each label becomes one rules_sources row.
const chunks = readdirSync(KB_DIR)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, KB_DIR), "utf8")));
const bySource = new Map();
for (const c of chunks) {
  if (!bySource.has(c.source)) bySource.set(c.source, []);
  bySource.get(c.source).push(c);
}

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

console.log(`${chunks.length} chunks in ${bySource.size} sources:`);
for (const [label, cs] of bySource) console.log(`  - ${label}: ${cs.length} chunks (curated/${slug(label)})`);
if (DRY) process.exit(0);

if (!SUPABASE_URL || !SERVICE_ROLE || !GEMINI_API_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY and/or GEMINI_API_KEY (and SUPABASE_URL).");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embedAll(items) {
  const out = [];
  const BATCH = 20;
  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    for (let attempt = 0; ; attempt++) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: slice.map((c) => ({
              model: `models/${EMBED_MODEL}`,
              content: { parts: [{ text: c.content }] },
              taskType: "RETRIEVAL_DOCUMENT",
              title: c.section,
              outputDimensionality: DIMS,
            })),
          }),
        },
      );
      if (r.ok) {
        const j = await r.json();
        out.push(...j.embeddings.map((e) => e.values));
        break;
      }
      const body = await r.text();
      if (r.status === 429 && attempt < 6) {
        const wait = 20000 * (attempt + 1);
        console.warn(`  rate limited, waiting ${wait / 1000}s…`);
        await sleep(wait);
        continue;
      }
      throw new Error(`embed failed [${r.status}]: ${body}`);
    }
    console.log(`  embedded ${Math.min(i + BATCH, items.length)}/${items.length}`);
  }
  return out;
}

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

for (const [label, cs] of bySource) {
  const storage_path = `curated/${slug(label)}`;
  console.log(`\n${label}`);

  const { data: src, error: upErr } = await db
    .from("rules_sources")
    .upsert(
      { storage_path, label, filename: `${slug(label)}.json`, status: "processing", error: null },
      { onConflict: "storage_path" },
    )
    .select("id")
    .single();
  if (upErr) throw upErr;

  try {
    const vecs = await embedAll(cs);
    const { error: delErr } = await db.from("rules_chunks").delete().eq("source_id", src.id);
    if (delErr) throw delErr;
    const rows = cs.map((c, i) => ({
      source_id: src.id,
      chunk_index: i,
      page_start: c.page_start,
      page_end: c.page_end,
      section: c.section,
      // Keep the section title in the text the chat model sees.
      content: c.content.startsWith(c.section) ? c.content : `[${c.section}]\n${c.content}`,
      embedding: `[${vecs[i].join(",")}]`,
    }));
    const { error: insErr } = await db.from("rules_chunks").insert(rows);
    if (insErr) throw insErr;
    const pages = Math.max(...cs.map((c) => c.page_end ?? c.page_start ?? 0));
    await db
      .from("rules_sources")
      .update({ status: "ready", chunk_count: rows.length, page_count: pages, error: null })
      .eq("id", src.id);
    console.log(`  ready: ${rows.length} chunks`);
  } catch (e) {
    await db.from("rules_sources").update({ status: "error", error: String(e?.message ?? e) }).eq("id", src.id);
    throw e;
  }
}
console.log("\nDone.");
