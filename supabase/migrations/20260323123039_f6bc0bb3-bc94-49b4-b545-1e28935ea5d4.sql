
-- Atomic function to claim a token, preventing duplicates
CREATE OR REPLACE FUNCTION public.claim_token(
  p_lobby_id UUID,
  p_player_id UUID,
  p_token_id INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_picks INTEGER[];
  v_token_mapping JSONB;
  v_faction JSONB;
  v_all_picks INTEGER[];
  v_picks_per_player INTEGER;
  v_current_picks INTEGER[];
BEGIN
  -- Lock the lobby row to prevent concurrent claims
  SELECT token_mapping, (settings->>'picks_per_player')::int
  INTO v_token_mapping, v_picks_per_player
  FROM lobbies
  WHERE id = p_lobby_id
  FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  -- Get current player's picks
  SELECT COALESCE(token_picks, '{}')
  INTO v_current_picks
  FROM lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_current_picks IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in lobby');
  END IF;

  -- Check if player already has enough picks
  IF array_length(v_current_picks, 1) >= v_picks_per_player THEN
    RETURN jsonb_build_object('error', 'Already picked maximum tokens');
  END IF;

  -- Check if token is already taken by ANY player in this lobby
  SELECT ARRAY_AGG(unnested)
  INTO v_all_picks
  FROM lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  IF p_token_id = ANY(COALESCE(v_all_picks, '{}')) THEN
    RETURN jsonb_build_object('error', 'Token already claimed');
  END IF;

  -- Get the faction for this token
  v_faction := v_token_mapping->(p_token_id::text);
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid token number');
  END IF;

  -- Claim the token
  UPDATE lobby_players
  SET 
    token_picks = array_append(COALESCE(token_picks, '{}'), p_token_id),
    assigned_factions = COALESCE(assigned_factions, '[]'::jsonb) || jsonb_build_array(v_faction)
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true, 'faction', v_faction);
END;
$$;
