-- 1. finish_game(): save every player's VP/rank AND mark the game finished in
--    one transaction. Before, the client wrote each player row separately and
--    then flipped the lobby to 'completed', so a dropped connection could
--    leave half-saved results.
-- 2. Scheduled auto-pick: run auto_assign_missing_factions() for every locked
--    lobby every 15 minutes, instead of waiting for someone to open the lobby.

-- ---------------------------------------------------------------------------
-- 1. finish_game
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_game(p_lobby_id uuid, p_results jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
  v_item jsonb;
  v_player_id uuid;
  v_vp integer;
  v_rank integer;
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id INTO v_host FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host IS DISTINCT FROM v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RETURN jsonb_build_object('error', 'invalid_results');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_player_id := (v_item->>'player_id')::uuid;
    v_vp := NULLIF(v_item->>'vp', '')::int;
    v_rank := NULLIF(v_item->>'rank', '')::int;

    UPDATE public.lobby_players
    SET vp = v_vp, rank = v_rank
    WHERE id = v_player_id AND lobby_id = p_lobby_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      -- Abort the whole save; nothing is written.
      RAISE EXCEPTION 'player_not_in_lobby: %', v_player_id;
    END IF;
  END LOOP;

  UPDATE public.lobbies
  SET started_at = COALESCE(started_at, now()),
      ended_at = COALESCE(ended_at, now()),
      status = 'completed'
  WHERE id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finish_game(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finish_game(uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Scheduled auto-pick
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_assign_all_locked_lobbies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby record;
  v_count integer := 0;
BEGIN
  FOR v_lobby IN
    SELECT l.id
    FROM public.lobbies l
    WHERE l.game_date IS NOT NULL
      AND l.game_date - interval '3 days' <= now()
      AND l.game_date > now() - interval '7 days'   -- skip old, abandoned lobbies
      AND l.status <> 'completed'
      AND EXISTS (
        SELECT 1 FROM public.lobby_players lp
        WHERE lp.lobby_id = l.id
          AND (
            lp.chosen_faction IS NULL
            OR COALESCE(array_length(lp.token_picks, 1), 0)
               < COALESCE((l.settings->>'picks_per_player')::int, 1)
          )
      )
  LOOP
    PERFORM public.auto_assign_missing_factions(v_lobby.id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Only the scheduler (postgres) runs this.
REVOKE EXECUTE ON FUNCTION public.auto_assign_all_locked_lobbies() FROM anon, authenticated, public;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Re-running cron.schedule with the same job name updates the existing job.
SELECT cron.schedule(
  'auto-assign-locked-lobbies',
  '*/15 * * * *',
  $$SELECT public.auto_assign_all_locked_lobbies();$$
);
