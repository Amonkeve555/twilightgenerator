
ALTER TABLE public.lobbies
  ADD COLUMN IF NOT EXISTS tile_control jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.set_tile_control(
  p_lobby_id uuid,
  p_q integer,
  p_r integer,
  p_seat_index integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_host uuid;
  v_key text := p_q::text || ',' || p_r::text;
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
    UPDATE public.lobbies
    SET tile_control = tile_control - v_key
    WHERE id = p_lobby_id;
  ELSE
    UPDATE public.lobbies
    SET tile_control = jsonb_set(
      COALESCE(tile_control, '{}'::jsonb),
      ARRAY[v_key],
      to_jsonb(p_seat_index),
      true
    )
    WHERE id = p_lobby_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_tile_control(p_lobby_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  UPDATE public.lobbies
  SET tile_control = '{}'::jsonb
  WHERE id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;
