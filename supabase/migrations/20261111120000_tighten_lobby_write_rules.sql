-- Tighten direct (REST) writes to lobbies and lobby_players.
--
-- Before: any player in a lobby could UPDATE every column of the lobby, and
-- every column of their own lobby_players row (token picks, assigned factions,
-- VP, rank...), bypassing the lock / uniqueness checks in the RPCs
-- (claim_token, claim_faction, ...). Any signed-in user could also take over
-- a lobby without a host.
--
-- After:
--  * Only the host (or an admin) can update a lobby directly. Players change
--    lobby state only through the SECURITY DEFINER RPCs, which keep working.
--  * On their own player row, a non-host may only change chosen_faction (and
--    only to one of their assigned factions), display_color, or link a guest
--    row to their own account (user_id NULL -> self).
--  * A non-host joining a lobby must insert a "blank" row (no picks/results).
--  * Hosts, admins and the RPCs (which run as the function owner) are not
--    restricted by the trigger.

-- 1. Lobbies: host/admin only for direct updates
DROP POLICY IF EXISTS "Hosts and players can update their lobby" ON public.lobbies;
CREATE POLICY "Hosts can update their lobby" ON public.lobbies
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'));

-- Guest-lobby claiming goes through claim_guest_data(); no direct takeover.
DROP POLICY IF EXISTS "Authenticated users can claim unclaimed lobbies" ON public.lobbies;

-- 2. lobby_players: restrict which columns non-hosts may write
CREATE OR REPLACE FUNCTION public.lobby_players_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_host boolean;
BEGIN
  -- Only police direct API calls. SECURITY DEFINER RPCs run as their owner,
  -- and the service role / SQL editor are trusted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT (l.host_user_id = v_uid) INTO v_is_host
  FROM public.lobbies l WHERE l.id = NEW.lobby_id;

  IF COALESCE(v_is_host, false) OR public.has_role(v_uid, 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(array_length(NEW.token_picks, 1), 0) > 0
       OR COALESCE(jsonb_array_length(NEW.assigned_factions), 0) > 0
       OR NEW.chosen_faction IS NOT NULL
       OR NEW.vp IS NOT NULL OR NEW.rank IS NOT NULL
       OR NEW.seat_index IS NOT NULL THEN
      RAISE EXCEPTION 'not_allowed: players must join with an empty row';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE by a non-host
  IF NEW.lobby_id IS DISTINCT FROM OLD.lobby_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.player_name IS DISTINCT FROM OLD.player_name
     OR NEW.token_picks IS DISTINCT FROM OLD.token_picks
     OR NEW.assigned_factions IS DISTINCT FROM OLD.assigned_factions
     OR NEW.vp IS DISTINCT FROM OLD.vp
     OR NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.seat_index IS DISTINCT FROM OLD.seat_index
     OR NEW.joined_at IS DISTINCT FROM OLD.joined_at THEN
    RAISE EXCEPTION 'not_allowed: only the host can change this';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND NOT (OLD.user_id IS NULL AND NEW.user_id = v_uid) THEN
    RAISE EXCEPTION 'not_allowed: cannot reassign player';
  END IF;

  IF NEW.chosen_faction IS DISTINCT FROM OLD.chosen_faction
     AND NEW.chosen_faction IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(OLD.assigned_factions, '[]'::jsonb)) f
       WHERE f->>'name' = NEW.chosen_faction->>'name'
     ) THEN
    RAISE EXCEPTION 'not_allowed: faction was not assigned to you';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lobby_players_guard ON public.lobby_players;
CREATE TRIGGER lobby_players_guard
  BEFORE INSERT OR UPDATE ON public.lobby_players
  FOR EACH ROW EXECUTE FUNCTION public.lobby_players_guard();
