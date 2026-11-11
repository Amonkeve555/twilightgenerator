-- 1. Add game_date column
ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS game_date timestamptz;

-- 2. Validation trigger for new lobbies (must have a future game_date)
CREATE OR REPLACE FUNCTION public.lobbies_validate_game_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only enforce on inserts; allow legacy rows (NULL) to remain.
  IF TG_OP = 'INSERT' THEN
    IF NEW.game_date IS NULL THEN
      RAISE EXCEPTION 'game_date_required';
    END IF;
    IF NEW.game_date < now() - interval '1 day' THEN
      RAISE EXCEPTION 'game_date_must_be_future';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lobbies_game_date_validate ON public.lobbies;
CREATE TRIGGER lobbies_game_date_validate
BEFORE INSERT ON public.lobbies
FOR EACH ROW EXECUTE FUNCTION public.lobbies_validate_game_date();

-- 3. Auto-assign random factions for any incomplete players (callable by anyone)
CREATE OR REPLACE FUNCTION public.auto_assign_missing_factions(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings jsonb;
  v_token_mapping jsonb;
  v_draft_mode text;
  v_picks_per_player int;
  v_factions jsonb;
  v_game_date timestamptz;
  v_player record;
  v_taken_tokens int[];
  v_taken_faction_names text[];
  v_available_tokens int[];
  v_available_factions jsonb;
  v_chosen_token int;
  v_chosen_faction jsonb;
  v_new_picks int[];
  v_new_factions jsonb;
  v_assigned int := 0;
BEGIN
  SELECT settings, token_mapping, game_date INTO v_settings, v_token_mapping, v_game_date
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  -- Only run when locked (within 3 days of game)
  IF v_game_date IS NULL OR v_game_date - interval '3 days' > now() THEN
    RETURN jsonb_build_object('success', true, 'assigned', 0, 'not_locked', true);
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_picks_per_player := COALESCE((v_settings->>'picks_per_player')::int, 1);
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);

  -- Collect already-claimed tokens
  SELECT COALESCE(array_agg(DISTINCT t), ARRAY[]::int[]) INTO v_taken_tokens
  FROM public.lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) t
  WHERE lp.lobby_id = p_lobby_id;

  -- Collect already-chosen faction names (for free modes)
  SELECT COALESCE(array_agg(DISTINCT lp.chosen_faction->>'name'), ARRAY[]::text[]) INTO v_taken_faction_names
  FROM public.lobby_players lp
  WHERE lp.lobby_id = p_lobby_id AND lp.chosen_faction IS NOT NULL;

  FOR v_player IN
    SELECT id, token_picks, assigned_factions, chosen_faction
    FROM public.lobby_players
    WHERE lobby_id = p_lobby_id
  LOOP
    IF v_draft_mode IN ('free', 'free_no_repeat') THEN
      IF v_player.chosen_faction IS NOT NULL THEN CONTINUE; END IF;

      SELECT jsonb_agg(f) INTO v_available_factions
      FROM jsonb_array_elements(v_factions) f
      WHERE NOT ((f->>'name') = ANY(v_taken_faction_names));

      IF v_available_factions IS NULL OR jsonb_array_length(v_available_factions) = 0 THEN CONTINUE; END IF;

      SELECT f INTO v_chosen_faction
      FROM jsonb_array_elements(v_available_factions) f
      ORDER BY random() LIMIT 1;

      UPDATE public.lobby_players
      SET chosen_faction = v_chosen_faction,
          assigned_factions = jsonb_build_array(v_chosen_faction),
          token_picks = ARRAY[0]
      WHERE id = v_player.id;

      v_taken_faction_names := array_append(v_taken_faction_names, v_chosen_faction->>'name');
      v_assigned := v_assigned + 1;
    ELSE
      -- Token modes
      IF COALESCE(array_length(v_player.token_picks, 1), 0) >= v_picks_per_player THEN CONTINUE; END IF;

      v_new_picks := COALESCE(v_player.token_picks, ARRAY[]::int[]);
      v_new_factions := COALESCE(v_player.assigned_factions, '[]'::jsonb);

      WHILE COALESCE(array_length(v_new_picks, 1), 0) < v_picks_per_player LOOP
        SELECT COALESCE(array_agg((k)::int), ARRAY[]::int[]) INTO v_available_tokens
        FROM jsonb_object_keys(v_token_mapping) k
        WHERE NOT ((k)::int = ANY(v_taken_tokens));

        EXIT WHEN v_available_tokens IS NULL OR array_length(v_available_tokens, 1) IS NULL;

        SELECT t INTO v_chosen_token FROM unnest(v_available_tokens) t ORDER BY random() LIMIT 1;
        v_new_picks := array_append(v_new_picks, v_chosen_token);
        v_new_factions := v_new_factions || jsonb_build_array(v_token_mapping->(v_chosen_token::text));
        v_taken_tokens := array_append(v_taken_tokens, v_chosen_token);
      END LOOP;

      UPDATE public.lobby_players
      SET token_picks = v_new_picks, assigned_factions = v_new_factions
      WHERE id = v_player.id;

      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'assigned', v_assigned);
END;
$$;

-- 4. Clear a single player's pick (player themselves or host) — only when not locked
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT lp.lobby_id, lp.user_id, l.host_user_id, l.game_date
  INTO v_lobby_id, v_player_user, v_host, v_game_date
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.id = p_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user <> v_user_id AND v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
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

-- 5. Update claim_token to enforce lock
CREATE OR REPLACE FUNCTION public.claim_token(p_lobby_id uuid, p_player_id uuid, p_token_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_game_date timestamptz;
BEGIN
  SELECT token_mapping, settings, (settings->>'picks_per_player')::int, game_date
  INTO v_token_mapping, v_settings, v_picks_per_player, v_game_date
  FROM lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
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

-- 6. Update claim_faction to enforce lock
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
  v_game_date timestamptz;
BEGIN
  SELECT settings, game_date INTO v_settings, v_game_date
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
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

-- 7. Update reset_lobby_draft to enforce lock
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

    SELECT COALESCE(jsonb_object_agg((idx - 1)::text, value), '{}'::jsonb)
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