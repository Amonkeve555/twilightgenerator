-- Race choice deadline = the pick lock (3 days before game_date).
--
-- * auto_assign_missing_factions() now also picks a race for every player who
--   has drafted options but never chose which one to play: a random one of
--   their own assigned factions. (Before, token-mode players were only given
--   missing tokens and chosen_faction stayed NULL until game day.)
-- * lobby_players_guard(): once the lobby is locked, a non-host can no longer
--   change their chosen_faction directly.

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
  v_autopicked int := 0;
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
      IF v_player.chosen_faction IS NOT NULL
         AND COALESCE(array_length(v_player.token_picks, 1), 0) >= v_picks_per_player THEN
        CONTINUE;
      END IF;

      v_new_picks := COALESCE(v_player.token_picks, ARRAY[]::int[]);
      v_new_factions := COALESCE(v_player.assigned_factions, '[]'::jsonb);

      IF COALESCE(array_length(v_new_picks, 1), 0) < v_picks_per_player THEN
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
        v_assigned := v_assigned + 1;
      END IF;

      -- Pick which race they play: keep their choice, else a random one of their options.
      v_chosen_faction := v_player.chosen_faction;
      IF v_chosen_faction IS NULL AND jsonb_array_length(v_new_factions) > 0 THEN
        SELECT f INTO v_chosen_faction
        FROM jsonb_array_elements(v_new_factions) f
        ORDER BY random() LIMIT 1;
        v_autopicked := v_autopicked + 1;
      END IF;

      UPDATE public.lobby_players
      SET token_picks = v_new_picks,
          assigned_factions = v_new_factions,
          chosen_faction = v_chosen_faction
      WHERE id = v_player.id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'assigned', v_assigned, 'autopicked', v_autopicked);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lobby_players_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_host boolean;
  v_game_date timestamptz;
BEGIN
  -- Only police direct API calls. SECURITY DEFINER RPCs run as their owner,
  -- and the service role / SQL editor are trusted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT (l.host_user_id = v_uid), l.game_date INTO v_is_host, v_game_date
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

  IF NEW.chosen_faction IS DISTINCT FROM OLD.chosen_faction THEN
    -- Race choice closes at the pick lock; unchosen races are auto-picked then.
    -- (Choosing for the first time is still allowed, in case auto-pick hasn't run yet.)
    IF OLD.chosen_faction IS NOT NULL
       AND v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
      RAISE EXCEPTION 'locked: race choice is frozen';
    END IF;

    IF NEW.chosen_faction IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(COALESCE(OLD.assigned_factions, '[]'::jsonb)) f
         WHERE f->>'name' = NEW.chosen_faction->>'name'
       ) THEN
      RAISE EXCEPTION 'not_allowed: faction was not assigned to you';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
