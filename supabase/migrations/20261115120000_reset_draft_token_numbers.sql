-- Reset Draft numbered tokens 0..N-1, but the token grid (and new lobbies)
-- use 1..N. After a reset, token N failed with "Invalid token number" and
-- the race mapped to token 0 could never be drawn. Number them 1..N.
-- (Only change vs. the previous version: idx instead of idx - 1.)
CREATE OR REPLACE FUNCTION public.reset_lobby_draft(p_lobby_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host_user_id uuid;
  v_settings jsonb;
  v_draft_mode text;
  v_factions jsonb;
  v_new_mapping jsonb;
  v_shuffled jsonb;
  v_game_date timestamptz;
BEGIN
  SELECT host_user_id, settings, game_date INTO v_host_user_id, v_settings, v_game_date
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_host_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);

  UPDATE public.lobby_players
  SET token_picks = '{}'::integer[],
      assigned_factions = '[]'::jsonb,
      chosen_faction = NULL,
      vp = NULL,
      rank = NULL
  WHERE lobby_id = p_lobby_id;

  IF v_draft_mode IN ('token', 'token_no_repeat') THEN
    SELECT jsonb_agg(f ORDER BY random())
    INTO v_shuffled
    FROM jsonb_array_elements(v_factions) f;

    SELECT COALESCE(jsonb_object_agg(idx::text, value), '{}'::jsonb)
    INTO v_new_mapping
    FROM jsonb_array_elements(COALESCE(v_shuffled, '[]'::jsonb)) WITH ORDINALITY AS t(value, idx);

    UPDATE public.lobbies
    SET token_mapping = v_new_mapping,
        status = 'waiting',
        started_at = NULL,
        ended_at = NULL,
        tile_control = '{}'::jsonb
    WHERE id = p_lobby_id;
  ELSE
    UPDATE public.lobbies
    SET status = 'waiting',
        started_at = NULL,
        ended_at = NULL,
        tile_control = '{}'::jsonb
    WHERE id = p_lobby_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;
