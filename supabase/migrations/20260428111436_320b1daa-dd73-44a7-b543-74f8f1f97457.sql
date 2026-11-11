-- Grant admin role to Marek
-- Guarded so it is a no-op on a fresh project where this user doesn't exist yet.
INSERT INTO public.user_roles (user_id, role)
SELECT 'bf1319b4-ffe0-4cee-9da8-59887d0993e0', 'admin'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = 'bf1319b4-ffe0-4cee-9da8-59887d0993e0')
ON CONFLICT (user_id, role) DO NOTHING;

-- Allow admins to see all roles
CREATE POLICY "Admins manage all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RPC: list all users (admin only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  full_name text,
  nickname text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, p.full_name, p.nickname
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at;
END;
$$;

-- RPC: link guest data (by session ids) to a target user (admin only)
CREATE OR REPLACE FUNCTION public.admin_link_guest_data(
  p_session_ids text[],
  p_target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hosted integer := 0;
  v_players integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_session_ids IS NULL OR cardinality(p_session_ids) = 0 THEN
    RETURN jsonb_build_object('error', 'no_session_ids');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_target_user');
  END IF;

  UPDATE public.lobbies
  SET host_user_id = p_target_user_id
  WHERE host_user_id IS NULL
    AND host_session_id = ANY(p_session_ids);
  GET DIAGNOSTICS v_hosted = ROW_COUNT;

  UPDATE public.lobby_players
  SET user_id = p_target_user_id
  WHERE user_id IS NULL
    AND session_id = ANY(p_session_ids);
  GET DIAGNOSTICS v_players = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'hosted_lobbies', v_hosted,
    'player_slots', v_players
  );
END;
$$;