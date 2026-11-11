-- Add seat_index column to lobby_players
ALTER TABLE public.lobby_players
ADD COLUMN IF NOT EXISTS seat_index integer;

-- Ensure each seat is unique within a lobby (only when assigned)
CREATE UNIQUE INDEX IF NOT EXISTS lobby_players_lobby_seat_unique
ON public.lobby_players (lobby_id, seat_index)
WHERE seat_index IS NOT NULL;

-- Assign a single seat (or clear it). Host or admin only.
CREATE OR REPLACE FUNCTION public.assign_seat(
  p_lobby_id uuid,
  p_player_id uuid,
  p_seat_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
  v_existing_player uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id INTO v_host FROM public.lobbies WHERE id = p_lobby_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF p_seat_index IS NULL THEN
    UPDATE public.lobby_players
    SET seat_index = NULL
    WHERE id = p_player_id AND lobby_id = p_lobby_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  -- If another player has this seat, clear theirs (swap/replace)
  SELECT id INTO v_existing_player
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND seat_index = p_seat_index
    AND id <> p_player_id;

  IF v_existing_player IS NOT NULL THEN
    -- Swap: give them the target player's previous seat (which may be null)
    UPDATE public.lobby_players
    SET seat_index = (
      SELECT seat_index FROM public.lobby_players
      WHERE id = p_player_id AND lobby_id = p_lobby_id
    )
    WHERE id = v_existing_player;
  END IF;

  UPDATE public.lobby_players
  SET seat_index = p_seat_index
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Shuffle: randomly assign all current players to seats 0..N-1
CREATE OR REPLACE FUNCTION public.shuffle_seats(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id INTO v_host FROM public.lobbies WHERE id = p_lobby_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Clear first to avoid unique conflicts mid-update
  UPDATE public.lobby_players SET seat_index = NULL WHERE lobby_id = p_lobby_id;

  WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY random()) - 1 AS new_seat
    FROM public.lobby_players
    WHERE lobby_id = p_lobby_id
  )
  UPDATE public.lobby_players lp
  SET seat_index = o.new_seat
  FROM ordered o
  WHERE lp.id = o.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Clear all seats in a lobby
CREATE OR REPLACE FUNCTION public.clear_seats(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT host_user_id INTO v_host FROM public.lobbies WHERE id = p_lobby_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  UPDATE public.lobby_players SET seat_index = NULL WHERE lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$$;