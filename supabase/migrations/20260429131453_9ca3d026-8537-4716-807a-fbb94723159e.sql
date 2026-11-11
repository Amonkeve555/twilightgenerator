-- Drop the old global-only helper; replaced by an opponent-aware version
DROP FUNCTION IF EXISTS public.get_last_played_faction_name(uuid);

-- New helper: most recent completed faction the user played in a lobby where
-- every given opponent (authenticated user_id) was also present.
CREATE OR REPLACE FUNCTION public.get_last_played_faction_vs_opponents(
  p_user_id uuid,
  p_opponent_ids uuid[]
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result text;
  v_opponent_count int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_opponent_count := COALESCE(array_length(p_opponent_ids, 1), 0);

  -- If there are no authenticated opponents to scope against, the rule does not apply.
  IF v_opponent_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT (lp.chosen_faction->>'name')
  INTO v_result
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.user_id = p_user_id
    AND l.status = 'completed'
    AND lp.chosen_faction IS NOT NULL
    AND (
      SELECT COUNT(DISTINCT lp2.user_id)
      FROM public.lobby_players lp2
      WHERE lp2.lobby_id = lp.lobby_id
        AND lp2.user_id = ANY(p_opponent_ids)
    ) = v_opponent_count
  ORDER BY l.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$function$;

-- Update claim_faction to use opponent-aware lookup
CREATE OR REPLACE FUNCTION public.claim_faction(p_lobby_id uuid, p_player_id uuid, p_faction jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_draft_mode text;
  v_factions jsonb;
  v_faction_name text;
  v_player_user_id uuid;
  v_already_taken int;
  v_in_pool int;
  v_last_faction text;
  v_other_choices int;
  v_opponents uuid[];
BEGIN
  SELECT settings INTO v_settings
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);
  v_faction_name := p_faction->>'name';

  IF v_faction_name IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_faction');
  END IF;

  SELECT COUNT(*) INTO v_in_pool
  FROM jsonb_array_elements(v_factions) f
  WHERE f->>'name' = v_faction_name;

  IF v_in_pool = 0 THEN
    RETURN jsonb_build_object('error', 'not_in_pool');
  END IF;

  SELECT user_id INTO v_player_user_id
  FROM public.lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_player_user_id IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*) INTO v_already_taken
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND id <> p_player_id
    AND chosen_faction IS NOT NULL
    AND chosen_faction->>'name' = v_faction_name;

  IF v_already_taken > 0 THEN
    RETURN jsonb_build_object('error', 'already_taken');
  END IF;

  IF v_draft_mode = 'free_no_repeat' AND v_player_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT lp.user_id), ARRAY[]::uuid[])
    INTO v_opponents
    FROM public.lobby_players lp
    WHERE lp.lobby_id = p_lobby_id
      AND lp.id <> p_player_id
      AND lp.user_id IS NOT NULL;

    v_last_faction := public.get_last_played_faction_vs_opponents(v_player_user_id, v_opponents);

    IF v_last_faction IS NOT NULL AND v_last_faction = v_faction_name THEN
      SELECT COUNT(*) INTO v_other_choices
      FROM jsonb_array_elements(v_factions) f
      WHERE f->>'name' <> v_last_faction
        AND NOT EXISTS (
          SELECT 1 FROM public.lobby_players lp
          WHERE lp.lobby_id = p_lobby_id
            AND lp.id <> p_player_id
            AND lp.chosen_faction IS NOT NULL
            AND lp.chosen_faction->>'name' = (f->>'name')
        );
      IF v_other_choices > 0 THEN
        RETURN jsonb_build_object('error', 'previous_faction');
      END IF;
    END IF;
  END IF;

  UPDATE public.lobby_players
  SET chosen_faction = p_faction,
      assigned_factions = jsonb_build_array(p_faction),
      token_picks = ARRAY[0]
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update get_forbidden_tokens to use opponent-aware lookup
CREATE OR REPLACE FUNCTION public.get_forbidden_tokens(p_lobby_id uuid)
RETURNS integer[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_draft_mode text;
  v_token_mapping jsonb;
  v_last_faction text;
  v_forbidden integer[];
  v_unclaimed_count int;
  v_forbidden_count int;
  v_all_picks integer[];
  v_opponents uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT settings, token_mapping INTO v_settings, v_token_mapping
  FROM public.lobbies WHERE id = p_lobby_id;

  IF v_settings IS NULL OR v_token_mapping IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  IF v_draft_mode <> 'token_no_repeat' THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lp.user_id), ARRAY[]::uuid[])
  INTO v_opponents
  FROM public.lobby_players lp
  WHERE lp.lobby_id = p_lobby_id
    AND lp.user_id IS NOT NULL
    AND lp.user_id <> v_user_id;

  v_last_faction := public.get_last_played_faction_vs_opponents(v_user_id, v_opponents);
  IF v_last_faction IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg((kv.key)::int), ARRAY[]::integer[])
  INTO v_forbidden
  FROM jsonb_each(v_token_mapping) kv
  WHERE kv.value->>'name' = v_last_faction;

  IF v_forbidden IS NULL OR array_length(v_forbidden, 1) IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT unnested), ARRAY[]::integer[])
  INTO v_all_picks
  FROM public.lobby_players lp,
       unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  SELECT COUNT(*) INTO v_unclaimed_count
  FROM jsonb_object_keys(v_token_mapping) k
  WHERE (k::int) <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  SELECT COUNT(*) INTO v_forbidden_count
  FROM unnest(v_forbidden) t
  WHERE t <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  IF v_unclaimed_count > 0 AND v_forbidden_count >= v_unclaimed_count THEN
    RETURN ARRAY[]::integer[];
  END IF;

  RETURN v_forbidden;
END;
$function$;