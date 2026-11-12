-- Players pick their own seat.
--
-- pick_my_seat(lobby, seat): the calling player takes a free home seat (or
-- moves to another free one, or leaves it with NULL). Seats stay secret in
-- the app until game day; a seat that is already taken is refused
-- ('seat_taken'), first come first served. Allowed until the pick lock
-- (3 days before game_date) and never after the game has started.
-- The host keeps full control through assign_seat / shuffle_seats / clear_seats.

CREATE OR REPLACE FUNCTION public.pick_my_seat(p_lobby_id uuid, p_seat_index integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_player_id uuid;
  v_game_date timestamptz;
  v_started timestamptz;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Lock the lobby row so two players can't grab the same seat at once.
  SELECT game_date, started_at, status INTO v_game_date, v_started, v_status
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_started IS NOT NULL OR v_status = 'completed'
     OR (v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now()) THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  SELECT id INTO v_player_id
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id AND user_id = v_user_id;
  IF v_player_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_in_lobby');
  END IF;

  IF p_seat_index IS NOT NULL THEN
    IF p_seat_index < 0 OR p_seat_index > 7 THEN
      RETURN jsonb_build_object('error', 'invalid_seat');
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.lobby_players
      WHERE lobby_id = p_lobby_id AND seat_index = p_seat_index AND id <> v_player_id
    ) THEN
      RETURN jsonb_build_object('error', 'seat_taken');
    END IF;
  END IF;

  UPDATE public.lobby_players SET seat_index = p_seat_index WHERE id = v_player_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pick_my_seat(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.pick_my_seat(uuid, integer) TO authenticated;
