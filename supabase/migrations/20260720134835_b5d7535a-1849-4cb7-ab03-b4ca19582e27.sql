
-- 1. Drop unused host_password column (was legacy, no client code uses it)
ALTER TABLE public.lobbies DROP COLUMN IF EXISTS host_password;

-- 2. Restrict lobbies SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read lobbies" ON public.lobbies;
CREATE POLICY "Authenticated users can read lobbies"
  ON public.lobbies FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.lobbies FROM anon;

-- 3. Restrict lobby_players SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read lobby players" ON public.lobby_players;
CREATE POLICY "Authenticated users can read lobby players"
  ON public.lobby_players FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.lobby_players FROM anon;

-- 4. Restrict profiles SELECT to authenticated
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 5. Restrict rules_sources SELECT to authenticated (hides uploaded_by from public)
DROP POLICY IF EXISTS "Anyone can view rules sources" ON public.rules_sources;
CREATE POLICY "Authenticated users can view rules sources"
  ON public.rules_sources FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.rules_sources FROM anon;

-- Also restrict rules_chunks to authenticated for consistency
DROP POLICY IF EXISTS "Anyone can read rules chunks" ON public.rules_chunks;
CREATE POLICY "Authenticated users can read rules chunks"
  ON public.rules_chunks FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.rules_chunks FROM anon;

-- 6. Remove duplicate user_roles SELECT policy
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;

-- 7. Revoke anonymous EXECUTE on SECURITY DEFINER functions that require sign-in
REVOKE EXECUTE ON FUNCTION public.start_game(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.end_game(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_seats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shuffle_seats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reset_lobby_draft(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_player_pick(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_tile_control(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_tile_control(uuid, integer, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_lobby_results(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_guest_data(text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_faction(uuid, uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_forbidden_tokens(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_last_played_faction_vs_opponents(uuid, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.match_rules_chunks(vector, integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.start_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shuffle_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_lobby_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_player_pick(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_tile_control(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tile_control(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lobby_results(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_data(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_faction(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forbidden_tokens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_played_faction_vs_opponents(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_rules_chunks(vector, integer) TO authenticated;
