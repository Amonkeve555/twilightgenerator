
-- Helper: get a user's most recently played faction name (from completed lobbies)
CREATE OR REPLACE FUNCTION public.get_last_played_faction_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (lp.chosen_faction->>'name')
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.user_id = p_user_id
    AND l.status = 'completed'
    AND lp.chosen_faction IS NOT NULL
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

-- Atomic free-pick faction claim
CREATE OR REPLACE FUNCTION public.claim_faction(p_lobby_id uuid, p_player_id uuid, p_faction jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Verify faction is in the lobby pool
  SELECT COUNT(*) INTO v_in_pool
  FROM jsonb_array_elements(v_factions) f
  WHERE f->>'name' = v_faction_name;

  IF v_in_pool = 0 THEN
    RETURN jsonb_build_object('error', 'not_in_pool');
  END IF;

  -- Verify player exists, get owner
  SELECT user_id INTO v_player_user_id
  FROM public.lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_player_user_id IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Check faction not already taken in this lobby
  SELECT COUNT(*) INTO v_already_taken
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND id <> p_player_id
    AND chosen_faction IS NOT NULL
    AND chosen_faction->>'name' = v_faction_name;

  IF v_already_taken > 0 THEN
    RETURN jsonb_build_object('error', 'already_taken');
  END IF;

  -- No-repeat enforcement (with fallback)
  IF v_draft_mode = 'free_no_repeat' AND v_player_user_id IS NOT NULL THEN
    v_last_faction := public.get_last_played_faction_name(v_player_user_id);
    IF v_last_faction IS NOT NULL AND v_last_faction = v_faction_name THEN
      -- Are there other available factions? (in pool, not taken by anyone else)
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
      -- else fall through (relax rule)
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

-- Get token IDs that the calling user should be blocked from claiming (token_no_repeat mode)
-- Returns empty if mode is not token_no_repeat or there'd be no alternative.
CREATE OR REPLACE FUNCTION public.get_forbidden_tokens(p_lobby_id uuid)
RETURNS integer[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  v_last_faction := public.get_last_played_faction_name(v_user_id);
  IF v_last_faction IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  -- Tokens whose mapped faction equals the last played faction
  SELECT COALESCE(array_agg((kv.key)::int), ARRAY[]::integer[])
  INTO v_forbidden
  FROM jsonb_each(v_token_mapping) kv
  WHERE kv.value->>'name' = v_last_faction;

  IF v_forbidden IS NULL OR array_length(v_forbidden, 1) IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  -- Fallback: if all unclaimed tokens are forbidden, return empty (allow repeat)
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
$$;

-- Update claim_token to enforce token_no_repeat
CREATE OR REPLACE FUNCTION public.claim_token(p_lobby_id uuid, p_player_id uuid, p_token_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_token_mapping JSONB;
  v_faction JSONB;
  v_all_picks INTEGER[];
  v_picks_per_player INTEGER;
  v_current_picks INTEGER[];
  v_player_user_id UUID;
  v_settings JSONB;
  v_draft_mode TEXT;
  v_forbidden INTEGER[];
BEGIN
  SELECT token_mapping, settings, (settings->>'picks_per_player')::int
  INTO v_token_mapping, v_settings, v_picks_per_player
  FROM lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');

  SELECT COALESCE(token_picks, '{}'), user_id
  INTO v_current_picks, v_player_user_id
  FROM lobby_players WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_current_picks IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in lobby');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized to claim for this player');
  END IF;

  IF array_length(v_current_picks, 1) >= v_picks_per_player THEN
    RETURN jsonb_build_object('error', 'Already picked maximum tokens');
  END IF;

  SELECT ARRAY_AGG(unnested) INTO v_all_picks
  FROM lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  IF p_token_id = ANY(COALESCE(v_all_picks, '{}')) THEN
    RETURN jsonb_build_object('error', 'Token already claimed');
  END IF;

  v_faction := v_token_mapping->(p_token_id::text);
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid token number');
  END IF;

  -- token_no_repeat enforcement
  IF v_draft_mode = 'token_no_repeat' THEN
    v_forbidden := public.get_forbidden_tokens(p_lobby_id);
    IF p_token_id = ANY(COALESCE(v_forbidden, ARRAY[]::integer[])) THEN
      RETURN jsonb_build_object('error', 'previous_faction');
    END IF;
  END IF;

  UPDATE lobby_players
  SET token_picks = array_append(COALESCE(token_picks, '{}'), p_token_id),
      assigned_factions = COALESCE(assigned_factions, '[]'::jsonb) || jsonb_build_array(v_faction)
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true, 'faction', v_faction);
END;
$function$;
