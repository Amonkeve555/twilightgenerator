import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import type { CustomMap } from "@/lib/customMap";

export interface MapTemplate {
  id: string;
  user_id: string;
  name: string;
  data: CustomMap;
  created_at: string;
  updated_at: string;
}

export async function listMyTemplates(): Promise<MapTemplate[]> {
  const { data, error } = await supabase
    .from("map_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MapTemplate[];
}

export async function saveTemplate(name: string, map: CustomMap): Promise<MapTemplate> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("map_templates")
    .insert({ user_id: uid, name, data: map as never })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as MapTemplate;
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; data?: CustomMap },
): Promise<void> {
  const update: TablesUpdate<"map_templates"> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.data !== undefined) update.data = patch.data as never;
  const { error } = await supabase.from("map_templates").update(update).eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("map_templates").delete().eq("id", id);
  if (error) throw error;
}
