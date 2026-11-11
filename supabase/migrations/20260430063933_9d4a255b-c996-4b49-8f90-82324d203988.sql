CREATE OR REPLACE FUNCTION public.update_lobby_results(p_lobby_id uuid, p_results jsonb)
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id INTO v_host FROM public.lobbies WHERE id = p_lobby_id;
  IF v_host IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RETURN jsonb_build_object('error', 'invalid_results');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_player_id := (v_item->>'player_id')::uuid;
    v_vp := COALESCE((v_item->>'vp')::int, 0);
    v_rank := COALESCE((v_item->>'rank')::int, 1);

    UPDATE public.lobby_players
    SET vp = v_vp, rank = v_rank
    WHERE id = v_player_id AND lobby_id = p_lobby_id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;