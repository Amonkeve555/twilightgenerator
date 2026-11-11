CREATE OR REPLACE FUNCTION public.reset_lobby_draft(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Clear all player picks for this lobby
  UPDATE public.lobby_players
  SET token_picks = '{}'::integer[],
      assigned_factions = '[]'::jsonb,
      chosen_faction = NULL,
      vp = NULL,
      rank = NULL
  WHERE lobby_id = p_lobby_id;

  -- Re-randomize token mapping for token-draft modes
  IF v_draft_mode IN ('token', 'token_no_repeat') THEN
    SELECT jsonb_agg(f ORDER BY random())
    INTO v_shuffled
    FROM jsonb_array_elements(v_factions) f;

    SELECT COALESCE(jsonb_object_agg((idx - 1)::text, value), '{}'::jsonb)
    INTO v_new_mapping
    FROM jsonb_array_elements(COALESCE(v_shuffled, '[]'::jsonb)) WITH ORDINALITY AS t(value, idx);

    UPDATE public.lobbies
    SET token_mapping = v_new_mapping,
        status = 'waiting'
    WHERE id = p_lobby_id;
  ELSE
    UPDATE public.lobbies
    SET status = 'waiting'
    WHERE id = p_lobby_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;