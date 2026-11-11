// RAG-grounded TI4 rules assistant.
// 1) Embed the latest user question.
// 2) Retrieve top-k chunks from public.rules_chunks via match_rules_chunks RPC.
// 3) Build a system prompt with numbered excerpts and stream a response.
// 4) Emit a final SSE event with structured citations the UI can render.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const CHAT_MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "gemini-embedding-001";

const FALLBACK_SYSTEM = `You are an expert rules judge for Twilight Imperium 4th Edition (TI4) including the Prophecy of Kings expansion. Answer accurately and clearly using bullet points and bold text where helpful. If you don't know, say so.`;

const GROUNDED_SYSTEM = (excerpts: string) => `You are an expert rules judge for Twilight Imperium 4th Edition (TI4).

You will answer using ONLY the numbered excerpts below, taken from official rulebook PDFs uploaded to this app. Rules:
- Cite the excerpt numbers you used like [1], [2] in your answer.
- If the excerpts do not contain the answer, say: "The uploaded rulebooks don't cover this — based on general TI4 knowledge:" and then answer carefully, flagging uncertainty.
- Prefer the most specific rule. If excerpts conflict, point it out.
- Use bullet points and bold for clarity. Keep answers concise but thorough.

EXCERPTS:
${excerpts}`;

async function embedQuery(text: string): Promise<number[]> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
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

interface Match {
  id: string;
  source_id: string;
  source_label: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  content: string;
  similarity: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require a signed-in user (the anon/publishable key alone is not enough).
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: userRes } = token
      ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token)
      : { data: { user: null } };
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: "sign_in_required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // Only accept user/assistant turns with plain text (no injected system prompts),
    // and cap history size to keep cost bounded.
    const messages = (Array.isArray(body?.messages) ? body.messages : [])
      .filter((m: { role?: unknown; content?: unknown }) =>
        (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
      .slice(-20)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === "user");
    const query: string = lastUser?.content ?? "";

    // Retrieve excerpts
    let citations: Array<{ n: number; label: string; page_start: number | null; page_end: number | null; excerpt: string }> = [];
    let systemPrompt = FALLBACK_SYSTEM;

    if (query.trim().length > 0) {
      try {
        const sb = createClient(SUPABASE_URL, ANON_KEY);
        const qVec = await embedQuery(query);
        const { data: matches, error } = await sb.rpc("match_rules_chunks", {
          query_embedding: `[${qVec.join(",")}]` as unknown as number[],
          match_count: 8,
        });
        if (error) console.error("match_rules_chunks error:", error);
        const ms = (matches ?? []) as Match[];
        if (ms.length > 0) {
          const lines = ms.map((m, i) => {
            const pg = m.page_start
              ? (m.page_end && m.page_end !== m.page_start
                ? `pp. ${m.page_start}–${m.page_end}`
                : `p. ${m.page_start}`)
              : "";
            const head = `[${i + 1}] ${m.source_label}${pg ? `, ${pg}` : ""}`;
            return `${head}\n${m.content}`;
          });
          systemPrompt = GROUNDED_SYSTEM(lines.join("\n\n---\n\n"));
          citations = ms.map((m, i) => ({
            n: i + 1,
            label: m.source_label,
            page_start: m.page_start,
            page_end: m.page_end,
            excerpt: m.content.length > 600 ? m.content.slice(0, 600) + "…" : m.content,
          }));
        }
      } catch (e) {
        console.error("retrieval failed, falling back:", e);
      }
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("AI gateway error:", upstream.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pipe upstream SSE through and append our citations event before [DONE]
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            // detect [DONE]
            const doneIdx = buf.indexOf("data: [DONE]");
            if (doneIdx !== -1) {
              const before = buf.slice(0, doneIdx);
              if (before) controller.enqueue(encoder.encode(before));
              const citationLine = `event: citations\ndata: ${JSON.stringify({ citations })}\n\n`;
              controller.enqueue(encoder.encode(citationLine));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              buf = "";
              // drain any remainder (shouldn't be any)
              while (true) {
                const r2 = await reader.read();
                if (r2.done) break;
              }
              break;
            }
            // flush on any newline boundary
            const lastNl = buf.lastIndexOf("\n");
            if (lastNl !== -1) {
              controller.enqueue(encoder.encode(buf.slice(0, lastNl + 1)));
              buf = buf.slice(lastNl + 1);
            }
          }
          if (buf) controller.enqueue(encoder.encode(buf));
        } catch (e) {
          console.error("stream error:", e);
          controller.error(e);
          return;
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("rules-chat error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "unknown",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
