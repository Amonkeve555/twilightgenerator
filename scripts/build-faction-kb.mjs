// Build English knowledge-base chunks for all factions (base game + Prophecy of Kings)
// from src/data/factions.ts (one chunk per faction). Output is picked up by
// scripts/load-rules-kb.mjs together with the curated Czech chunks.
//
// Usage: node scripts/build-faction-kb.mjs   (Node 23.6+ loads the .ts file directly)

import { writeFileSync } from "node:fs";
import { TI4_FACTIONS, POK_FACTIONS, GENERIC_TECH } from "../src/data/factions.ts";

const SOURCES = [
  ["Base game – faction reference (EN)", TI4_FACTIONS],
  ["Prophecy of Kings – faction reference (EN)", POK_FACTIONS],
];

const unitLine = (label, u) =>
  `- ${label}: ${u.name} — ${u.stats}${u.description ? `. ${u.description}` : ""}`;

const chunks = SOURCES.flatMap(([source, factions]) => factions.map((f) => {
  const lines = [
    `FACTION: ${f.name}`,
    `Commodities: ${f.commodities}`,
    "Faction abilities:",
    ...(f.abilities ?? []).map((a) => `- ${a}`),
  ];
  const units = [
    f.flagship && unitLine("Flagship", f.flagship),
    f.mech && unitLine("Mech", f.mech),
    ...(f.factionUnits ?? []).map((u) => unitLine(`Faction ${u.replaces ?? "unit"}`, u)),
  ].filter(Boolean);
  if (units.length) lines.push("Faction units:", ...units);
  if (f.factionTech?.length) {
    lines.push("Faction technologies:");
    for (const t of f.factionTech) {
      const kind = t.type === "unit" ? "unit upgrade" : `${t.type} tech`;
      lines.push(`- ${t.name} (${kind}, prerequisites ${t.prerequisites || "none"}): ${t.description}`);
    }
  }
  const agents = [f.agent, ...(f.additionalAgents ?? [])].filter(Boolean);
  lines.push(agents.length > 1 ? "Leaders – agents:" : "Leaders:");
  for (const a of agents) lines.push(`- Agent ${a.name}: ${a.description}`);
  if (f.commander) lines.push(`- Commander ${f.commander.name} (unlock: ${f.commander.unlock}): ${f.commander.description}`);
  if (f.hero) lines.push(`- Hero ${f.hero.name} (unlock: Have 3 scored objectives): ${f.hero.description}`);
  if (f.promissoryNote) lines.push(`Promissory note(s): ${f.promissoryNote}`);
  lines.push(`Starting units: ${f.startingUnits}`);
  const techs = (f.startingTech ?? []).map((t) => (GENERIC_TECH[t] ? `${t} (${GENERIC_TECH[t].description})` : t));
  lines.push(
    `Starting technology${f.startingTechChoose ? ` (choose ${f.startingTechChoose} of these)` : ""}: ${techs.join("; ")}`,
  );
  return {
    source,
    page_start: null,
    page_end: null,
    section: `${f.name} – faction reference: abilities, units, technologies, leaders, promissory notes`,
    content: lines.join("\n"),
  };
}));

const out = new URL("../supabase/rules_kb/factions_en.json", import.meta.url);
writeFileSync(out, JSON.stringify(chunks, null, 1) + "\n");
console.log(`${chunks.length} chunks → supabase/rules_kb/factions_en.json`);
for (const c of chunks) console.log(`  ${c.content.length.toString().padStart(5)}  ${c.section}`);
