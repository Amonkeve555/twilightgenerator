import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TI4_FACTIONS, POK_FACTIONS, type Faction } from "@/data/factions";

const BASE: Faction[] = [...TI4_FACTIONS, ...POK_FACTIONS];

/**
 * Returns the faction list merged with admin-approved overrides
 * stored in the `faction_data_overrides` table. Falls back to the
 * built-in data when overrides are missing or the query fails.
 */
export function useMergedFactions() {
  const [overrides, setOverrides] = useState<Record<string, Partial<Faction>>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("faction_data_overrides")
      .select("faction_name, data")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("faction overrides load failed", error);
          setLoaded(true);
          return;
        }
        const map: Record<string, Partial<Faction>> = {};
        for (const row of (data ?? []) as Array<{ faction_name: string; data: Partial<Faction> }>) {
          map[row.faction_name] = row.data;
        }
        setOverrides(map);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  const ti4 = useMemo(() => TI4_FACTIONS.map((f) => mergeFaction(f, overrides[f.name])), [overrides]);
  const pok = useMemo(() => POK_FACTIONS.map((f) => mergeFaction(f, overrides[f.name])), [overrides]);
  const all = useMemo(() => BASE.map((f) => mergeFaction(f, overrides[f.name])), [overrides]);

  return { ti4, pok, all, loaded };
}

function mergeFaction(base: Faction, override?: Partial<Faction>): Faction {
  if (!override) return base;
  // Only override fields that are actually provided. Keep base color/shortName intact.
  return {
    ...base,
    ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined && v !== null)),
    name: base.name,
    shortName: base.shortName,
    color: base.color,
  } as Faction;
}
