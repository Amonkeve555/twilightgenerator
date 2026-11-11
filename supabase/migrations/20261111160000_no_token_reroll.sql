-- No re-rolls in token drafts.
--
-- clear_player_pick() let a player wipe their own drawn tokens and draw again
-- until they liked the result. In token modes ('token', 'token_no_repeat') a
-- player can no longer clear their own picks; the host (or an admin) can still
-- clear another player's picks, or reset the whole draft. Free-pick modes are
-- unchanged (nothing random to re-roll there).

CREATE OR REPLACE FUNCTION public.clear_player_pick(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lobby_id uuid;
  v_player_user uuid;
  v_host uuid;
  v_game_date timestamptz;
  v_draft_mode text;
  v_is_admin boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT lp.lobby_id, lp.user_id, l.host_user_id, l.game_date,
         COALESCE(l.settings->>'draft_mode', 'token')
  INTO v_lobby_id, v_player_user, v_host, v_game_date, v_draft_mode
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.id = p_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  v_is_admin := public.has_role(v_user_id, 'admin'::app_role);

  IF v_player_user IS DISTINCT FROM v_user_id
     AND v_host IS DISTINCT FROM v_user_id
     AND NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Token draws are final: nobody may re-roll their own tokens
  -- (not even the host on their own row — they can reset the whole draft).
  IF v_draft_mode IN ('token', 'token_no_repeat')
     AND v_player_user IS NOT DISTINCT FROM v_user_id
     AND NOT v_is_admin THEN
    RETURN jsonb_build_object('error', 'no_reroll');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  UPDATE public.lobby_players
  SET token_picks = '{}'::int[],
      assigned_factions = '[]'::jsonb,
      chosen_faction = NULL
  WHERE id = p_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_player_pick(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.clear_player_pick(uuid) TO authenticated;
