CREATE OR REPLACE FUNCTION public.claim_guest_data(p_session_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_hosted_count integer := 0;
  v_player_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  IF p_session_ids IS NULL OR cardinality(p_session_ids) = 0 THEN
    RETURN jsonb_build_object('error', 'no_session_ids');
  END IF;

  UPDATE public.lobbies
  SET host_user_id = v_user_id
  WHERE host_user_id IS NULL
    AND host_session_id = ANY(p_session_ids);
  GET DIAGNOSTICS v_hosted_count = ROW_COUNT;

  UPDATE public.lobby_players
  SET user_id = v_user_id
  WHERE user_id IS NULL
    AND session_id = ANY(p_session_ids);
  GET DIAGNOSTICS v_player_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'hosted_lobbies', v_hosted_count,
    'player_slots', v_player_count
  );
END;
$$;