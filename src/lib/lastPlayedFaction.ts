import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the name of the faction the given user played in their most recent
 * completed game where every authenticated opponent was also present.
 * Returns null if there is no such game, or if there are no opponents to scope against.
 */
export async function getLastPlayedFactionVsOpponents(
  userId: string,
  opponentIds: string[]
): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_last_played_faction_vs_opponents", {
    p_user_id: userId,
    p_opponent_ids: opponentIds,
  });
  if (error) {
    console.error("get_last_played_faction_vs_opponents", error);
    return null;
  }
  return (data as string | null) ?? null;
}
