-- Add timer columns to lobbies
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz NULL;

-- Start the game: stamps started_at and sets status to in_progress
CREATE OR REPLACE FUNCTION public.start_game(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
  v_started timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id, started_at INTO v_host, v_started
  FROM public.lobbies WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_started IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_started', true);
  END IF;

  UPDATE public.lobbies
  SET started_at = now(),
      ended_at = NULL,
      status = 'in_progress'
  WHERE id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- End the game: stamps ended_at if not already set
CREATE OR REPLACE FUNCTION public.end_game(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
  v_started timestamptz;
  v_ended timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id, started_at, ended_at INTO v_host, v_started, v_ended
  FROM public.lobbies WHERE id = p_lobby_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_started IS NULL THEN
    UPDATE public.lobbies
    SET started_at = now(), ended_at = now()
    WHERE id = p_lobby_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  IF v_ended IS NULL THEN
    UPDATE public.lobbies SET ended_at = now() WHERE id = p_lobby_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update reset_lobby_draft to also clear timer
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
BEGIN
  SELECT host_user_id, settings INTO v_host_user_id, v_settings
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_host_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
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