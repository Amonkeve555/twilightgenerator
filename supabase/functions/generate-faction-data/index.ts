// Generate a structured faction data proposal from already-ingested rule PDFs.
// Admin-only. Reuses the rules_chunks pgvector index and Gemini embeddings,
// then asks Lovable AI Gateway (Gemini) for structured JSON.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const EMBED_MODEL = "gemini-embedding-001";
const CHAT_MODEL = "google/gemini-2.5-flash";

async function embedQuery(text: string): Promise<number[]> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
        outputDimensionality: 768,
      }),
    },
  );
  if (!r.ok) throw new Error(`embed failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.embedding.values as number[];
}

const PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    abilities: { type: "array", items: { type: "string" } },
    promissoryNote: { type: "string" },
    startingUnits: { type: "string" },
    startingTech: { type: "array", items: { type: "string" } },
    commodities: { type: "number" },
    factionTech: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["unit", "green", "blue", "yellow", "red"] },
          prerequisites: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "type", "description"],
      },
    },
    agent: {
      type: "object",
      properties: { name: { type: "string" }, description: { type: "string" } },
      required: ["name", "description"],
    },
    commander: {
      type: "object",
      properties: {
        name: { type: "string" },
        unlock: { type: "string" },
        description: { type: "string" },
      },
      required: ["name", "unlock", "description"],
    },
    hero: {
      type: "object",
      properties: { name: { type: "string" }, description: { type: "string" } },
      required: ["name", "description"],
    },
    strategyTip: { type: "string" },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin.from("user_roles")
      .select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const factionName: string = body.faction_name;
    const currentData = body.current_data ?? null;
    if (!factionName) {
      return new Response(JSON.stringify({ error: "faction_name required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retrieve rules chunks relevant to this faction.
    const query = `${factionName} faction abilities promissory note starting units starting technology commodities faction technology agent commander hero`;
    const qVec = await embedQuery(query);
    const { data: matches, error: mErr } = await admin.rpc("match_rules_chunks", {
      query_embedding: `[${qVec.join(",")}]` as unknown as number[],
      match_count: 12,
    });
    if (mErr) throw mErr;
    type Match = {
      id: string; source_label: string;
      page_start: number | null; page_end: number | null;
      content: string; similarity: number;
    };
    const ms = (matches ?? []) as Match[];
    if (ms.length === 0) {
      return new Response(JSON.stringify({ error: "no_chunks_found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const excerpts = ms.map((m, i) => {
      const pg = m.page_start
        ? (m.page_end && m.page_end !== m.page_start
          ? `pp. ${m.page_start}-${m.page_end}`
          : `p. ${m.page_start}`)
        : "";
      return `[${i + 1}] ${m.source_label}${pg ? `, ${pg}` : ""}\n${m.content}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `You are extracting structured Twilight Imperium 4th Edition faction data from official rulebook excerpts.

Return ONLY a JSON object matching the requested schema. Use the official wording from the excerpts as closely as possible. If a field is not present in the excerpts, omit it. Do not invent content.

Field guidance:
- abilities: list of named faction abilities, each as "Name: full rules text".
- promissoryNote: "Name — full rules text".
- startingUnits: comma-separated, e.g. "2 Carriers, 1 Cruiser, 4 Infantry, 2 Fighters, 1 Space Dock".
- startingTech: array of technology names.
- factionTech: each object has name, type (unit/green/blue/yellow/red), prerequisites (e.g. "GG", "BBY"), and description.
- agent/commander/hero: { name, description } and commander has unlock.

EXCERPTS:
${excerpts}`;

    const userPrompt = `Extract the data for the faction: "${factionName}".

For reference, the app currently stores this data (you may correct it where the excerpts disagree):
${currentData ? JSON.stringify(currentData, null, 2) : "(none)"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "submit_faction_data",
            description: "Submit the structured faction data extracted from the excerpts.",
            parameters: PROPOSAL_SCHEMA,
          },
        }],
        tool_choice: { type: "function", function: { name: "submit_faction_data" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiRes.status}`);
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("No tool call returned:", JSON.stringify(aiJson));
      throw new Error("model_returned_no_structured_data");
    }
    let proposalData: Record<string, unknown>;
    try {
      proposalData = JSON.parse(argsStr);
    } catch (e) {
      throw new Error(`invalid_json_from_model: ${(e as Error).message}`);
    }

    const citations = ms.map((m, i) => ({
      n: i + 1,
      label: m.source_label,
      page_start: m.page_start,
      page_end: m.page_end,
      excerpt: m.content.length > 600 ? m.content.slice(0, 600) + "…" : m.content,
    }));

    const { data: row, error: insErr } = await admin
      .from("faction_data_proposals")
      .insert({
        proposal: { faction_name: factionName, data: proposalData, citations },
        notes: `Auto-generated from ${ms.length} rule excerpts`,
        created_by: user.id,
        status: "pending",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, proposal: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-faction-data error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown",
    }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
