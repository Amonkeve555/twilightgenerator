-- All migrations in order, for pasting into Supabase Dashboard -> SQL Editor on a NEW project.
-- Generated from supabase/migrations/. Run once.

-- ===== 20260323122228_6feece9c-3ea2-4ac4-8986-1bb05f36fa3b.sql =====

-- Create lobbies table
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_code TEXT NOT NULL UNIQUE,
  host_session_id TEXT NOT NULL,
  host_name TEXT NOT NULL DEFAULT 'Host',
  settings JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'completed')),
  token_mapping JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lobby_players table
CREATE TABLE public.lobby_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  token_picks INTEGER[] DEFAULT '{}',
  assigned_factions JSONB DEFAULT '[]',
  chosen_faction JSONB,
  vp INTEGER,
  rank INTEGER,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, session_id)
);

-- Enable RLS
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_players ENABLE ROW LEVEL SECURITY;

-- Lobbies: public access (no auth)
CREATE POLICY "Anyone can read lobbies" ON public.lobbies FOR SELECT USING (true);
CREATE POLICY "Anyone can create lobbies" ON public.lobbies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lobbies" ON public.lobbies FOR UPDATE USING (true);

-- Lobby players: public access (no auth)
CREATE POLICY "Anyone can read lobby players" ON public.lobby_players FOR SELECT USING (true);
CREATE POLICY "Anyone can join lobby" ON public.lobby_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update lobby players" ON public.lobby_players FOR UPDATE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lobby_players;

-- Indexes
CREATE INDEX idx_lobbies_invite_code ON public.lobbies(invite_code);
CREATE INDEX idx_lobby_players_lobby_id ON public.lobby_players(lobby_id);

-- ===== 20260323122735_e2e4418d-ee7b-4791-8481-4413395e9148.sql =====

-- Allow deleting lobbies
CREATE POLICY "Anyone can delete lobbies" ON public.lobbies FOR DELETE USING (true);

-- Allow deleting lobby players
CREATE POLICY "Anyone can delete lobby players" ON public.lobby_players FOR DELETE USING (true);

-- ===== 20260323123039_f6bc0bb3-bc94-49b4-b545-1e28935ea5d4.sql =====

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

-- ===== 20260323150129_63dcbd63-2131-46c0-9d46-9c53e5bdcb90.sql =====
ALTER TABLE public.lobbies ADD COLUMN host_password text NOT NULL DEFAULT '';

-- ===== 20260428102055_546dfba6-b13f-4ee2-b3a8-4e2cb6824042.sql =====

-- ===== Roles infrastructure =====
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  nickname TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, nickname)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NULL);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Add columns FIRST (before policies that reference them) =====
ALTER TABLE public.lobbies
  ADD COLUMN host_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_lobbies_host_user_id ON public.lobbies(host_user_id);

ALTER TABLE public.lobby_players
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX idx_lobby_players_user_id ON public.lobby_players(user_id);

-- ===== Replace permissive lobby policies =====
DROP POLICY IF EXISTS "Anyone can create lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Anyone can update lobbies" ON public.lobbies;
DROP POLICY IF EXISTS "Anyone can delete lobbies" ON public.lobbies;

CREATE POLICY "Authenticated users can create lobbies" ON public.lobbies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts and players can update their lobby" ON public.lobbies
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = host_user_id
    OR EXISTS (SELECT 1 FROM public.lobby_players WHERE lobby_id = lobbies.id AND user_id = auth.uid())
  );

CREATE POLICY "Hosts can delete their lobby" ON public.lobbies
  FOR DELETE TO authenticated
  USING (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'));

-- ===== Replace permissive lobby_players policies =====
DROP POLICY IF EXISTS "Anyone can join lobby" ON public.lobby_players;
DROP POLICY IF EXISTS "Anyone can update lobby players" ON public.lobby_players;
DROP POLICY IF EXISTS "Anyone can delete lobby players" ON public.lobby_players;

CREATE POLICY "Authenticated users can join lobbies" ON public.lobby_players
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players and hosts can update player rows" ON public.lobby_players
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.lobbies WHERE id = lobby_players.lobby_id AND host_user_id = auth.uid())
  );

CREATE POLICY "Players and hosts can delete player rows" ON public.lobby_players
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.lobbies WHERE id = lobby_players.lobby_id AND host_user_id = auth.uid())
  );

-- ===== Update claim_token to verify caller =====
CREATE OR REPLACE FUNCTION public.claim_token(p_lobby_id uuid, p_player_id uuid, p_token_id integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_mapping JSONB;
  v_faction JSONB;
  v_all_picks INTEGER[];
  v_picks_per_player INTEGER;
  v_current_picks INTEGER[];
  v_player_user_id UUID;
BEGIN
  SELECT token_mapping, (settings->>'picks_per_player')::int
  INTO v_token_mapping, v_picks_per_player
  FROM lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  SELECT COALESCE(token_picks, '{}'), user_id
  INTO v_current_picks, v_player_user_id
  FROM lobby_players WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_current_picks IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in lobby');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized to claim for this player');
  END IF;

  IF array_length(v_current_picks, 1) >= v_picks_per_player THEN
    RETURN jsonb_build_object('error', 'Already picked maximum tokens');
  END IF;

  SELECT ARRAY_AGG(unnested) INTO v_all_picks
  FROM lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  IF p_token_id = ANY(COALESCE(v_all_picks, '{}')) THEN
    RETURN jsonb_build_object('error', 'Token already claimed');
  END IF;

  v_faction := v_token_mapping->(p_token_id::text);
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid token number');
  END IF;

  UPDATE lobby_players
  SET token_picks = array_append(COALESCE(token_picks, '{}'), p_token_id),
      assigned_factions = COALESCE(assigned_factions, '[]'::jsonb) || jsonb_build_array(v_faction)
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true, 'faction', v_faction);
END;
$$;

-- ===== 20260428102111_ebbd6567-99ee-496b-8738-ba2add43cbbf.sql =====

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) TO authenticated;

-- ===== 20260428104728_08ac3299-a56a-4585-88ac-91f1afb1de35.sql =====
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

REVOKE EXECUTE ON FUNCTION public.claim_guest_data(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_data(text[]) TO authenticated;

-- ===== 20260428104753_05f0f860-00bf-4890-a4aa-787ea2eab518.sql =====
CREATE OR REPLACE FUNCTION public.claim_guest_data(p_session_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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

DROP POLICY IF EXISTS "Authenticated users can claim unclaimed lobbies" ON public.lobbies;
CREATE POLICY "Authenticated users can claim unclaimed lobbies"
ON public.lobbies
FOR UPDATE
TO authenticated
USING (host_user_id IS NULL)
WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can claim unclaimed player rows" ON public.lobby_players;
CREATE POLICY "Authenticated users can claim unclaimed player rows"
ON public.lobby_players
FOR UPDATE
TO authenticated
USING (user_id IS NULL)
WITH CHECK (user_id = auth.uid());

-- ===== 20260428111436_320b1daa-dd73-44a7-b543-74f8f1f97457.sql =====
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

-- ===== 20260428111448_a5f3e376-5b25-4065-aa84-61681db2fc05.sql =====
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) TO authenticated;

-- ===== 20260428111639_ef51b672-3829-4812-92ac-9608f5a902b0.sql =====
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

-- ===== 20260428121632_581a6197-712e-4543-b499-8ef40589400d.sql =====

-- Helper: get a user's most recently played faction name (from completed lobbies)
CREATE OR REPLACE FUNCTION public.get_last_played_faction_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (lp.chosen_faction->>'name')
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.user_id = p_user_id
    AND l.status = 'completed'
    AND lp.chosen_faction IS NOT NULL
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

-- Atomic free-pick faction claim
CREATE OR REPLACE FUNCTION public.claim_faction(p_lobby_id uuid, p_player_id uuid, p_faction jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_settings jsonb;
  v_draft_mode text;
  v_factions jsonb;
  v_faction_name text;
  v_player_user_id uuid;
  v_already_taken int;
  v_in_pool int;
  v_last_faction text;
  v_other_choices int;
BEGIN
  SELECT settings INTO v_settings
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);
  v_faction_name := p_faction->>'name';

  IF v_faction_name IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_faction');
  END IF;

  -- Verify faction is in the lobby pool
  SELECT COUNT(*) INTO v_in_pool
  FROM jsonb_array_elements(v_factions) f
  WHERE f->>'name' = v_faction_name;

  IF v_in_pool = 0 THEN
    RETURN jsonb_build_object('error', 'not_in_pool');
  END IF;

  -- Verify player exists, get owner
  SELECT user_id INTO v_player_user_id
  FROM public.lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_player_user_id IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  -- Check faction not already taken in this lobby
  SELECT COUNT(*) INTO v_already_taken
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND id <> p_player_id
    AND chosen_faction IS NOT NULL
    AND chosen_faction->>'name' = v_faction_name;

  IF v_already_taken > 0 THEN
    RETURN jsonb_build_object('error', 'already_taken');
  END IF;

  -- No-repeat enforcement (with fallback)
  IF v_draft_mode = 'free_no_repeat' AND v_player_user_id IS NOT NULL THEN
    v_last_faction := public.get_last_played_faction_name(v_player_user_id);
    IF v_last_faction IS NOT NULL AND v_last_faction = v_faction_name THEN
      -- Are there other available factions? (in pool, not taken by anyone else)
      SELECT COUNT(*) INTO v_other_choices
      FROM jsonb_array_elements(v_factions) f
      WHERE f->>'name' <> v_last_faction
        AND NOT EXISTS (
          SELECT 1 FROM public.lobby_players lp
          WHERE lp.lobby_id = p_lobby_id
            AND lp.id <> p_player_id
            AND lp.chosen_faction IS NOT NULL
            AND lp.chosen_faction->>'name' = (f->>'name')
        );
      IF v_other_choices > 0 THEN
        RETURN jsonb_build_object('error', 'previous_faction');
      END IF;
      -- else fall through (relax rule)
    END IF;
  END IF;

  UPDATE public.lobby_players
  SET chosen_faction = p_faction,
      assigned_factions = jsonb_build_array(p_faction),
      token_picks = ARRAY[0]
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Get token IDs that the calling user should be blocked from claiming (token_no_repeat mode)
-- Returns empty if mode is not token_no_repeat or there'd be no alternative.
CREATE OR REPLACE FUNCTION public.get_forbidden_tokens(p_lobby_id uuid)
RETURNS integer[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_draft_mode text;
  v_token_mapping jsonb;
  v_last_faction text;
  v_forbidden integer[];
  v_unclaimed_count int;
  v_forbidden_count int;
  v_all_picks integer[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT settings, token_mapping INTO v_settings, v_token_mapping
  FROM public.lobbies WHERE id = p_lobby_id;

  IF v_settings IS NULL OR v_token_mapping IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  IF v_draft_mode <> 'token_no_repeat' THEN
    RETURN ARRAY[]::integer[];
  END IF;

  v_last_faction := public.get_last_played_faction_name(v_user_id);
  IF v_last_faction IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  -- Tokens whose mapped faction equals the last played faction
  SELECT COALESCE(array_agg((kv.key)::int), ARRAY[]::integer[])
  INTO v_forbidden
  FROM jsonb_each(v_token_mapping) kv
  WHERE kv.value->>'name' = v_last_faction;

  IF v_forbidden IS NULL OR array_length(v_forbidden, 1) IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  -- Fallback: if all unclaimed tokens are forbidden, return empty (allow repeat)
  SELECT COALESCE(array_agg(DISTINCT unnested), ARRAY[]::integer[])
  INTO v_all_picks
  FROM public.lobby_players lp,
       unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  SELECT COUNT(*) INTO v_unclaimed_count
  FROM jsonb_object_keys(v_token_mapping) k
  WHERE (k::int) <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  SELECT COUNT(*) INTO v_forbidden_count
  FROM unnest(v_forbidden) t
  WHERE t <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  IF v_unclaimed_count > 0 AND v_forbidden_count >= v_unclaimed_count THEN
    RETURN ARRAY[]::integer[];
  END IF;

  RETURN v_forbidden;
END;
$$;

-- Update claim_token to enforce token_no_repeat
CREATE OR REPLACE FUNCTION public.claim_token(p_lobby_id uuid, p_player_id uuid, p_token_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_token_mapping JSONB;
  v_faction JSONB;
  v_all_picks INTEGER[];
  v_picks_per_player INTEGER;
  v_current_picks INTEGER[];
  v_player_user_id UUID;
  v_settings JSONB;
  v_draft_mode TEXT;
  v_forbidden INTEGER[];
BEGIN
  SELECT token_mapping, settings, (settings->>'picks_per_player')::int
  INTO v_token_mapping, v_settings, v_picks_per_player
  FROM lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');

  SELECT COALESCE(token_picks, '{}'), user_id
  INTO v_current_picks, v_player_user_id
  FROM lobby_players WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_current_picks IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in lobby');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized to claim for this player');
  END IF;

  IF array_length(v_current_picks, 1) >= v_picks_per_player THEN
    RETURN jsonb_build_object('error', 'Already picked maximum tokens');
  END IF;

  SELECT ARRAY_AGG(unnested) INTO v_all_picks
  FROM lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  IF p_token_id = ANY(COALESCE(v_all_picks, '{}')) THEN
    RETURN jsonb_build_object('error', 'Token already claimed');
  END IF;

  v_faction := v_token_mapping->(p_token_id::text);
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid token number');
  END IF;

  -- token_no_repeat enforcement
  IF v_draft_mode = 'token_no_repeat' THEN
    v_forbidden := public.get_forbidden_tokens(p_lobby_id);
    IF p_token_id = ANY(COALESCE(v_forbidden, ARRAY[]::integer[])) THEN
      RETURN jsonb_build_object('error', 'previous_faction');
    END IF;
  END IF;

  UPDATE lobby_players
  SET token_picks = array_append(COALESCE(token_picks, '{}'), p_token_id),
      assigned_factions = COALESCE(assigned_factions, '[]'::jsonb) || jsonb_build_array(v_faction)
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true, 'faction', v_faction);
END;
$function$;

-- ===== 20260428140732_1eab1e4d-d666-421f-bdc1-2e0d2d0575df.sql =====
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

-- ===== 20260429131453_9ca3d026-8537-4716-807a-fbb94723159e.sql =====
-- Drop the old global-only helper; replaced by an opponent-aware version
DROP FUNCTION IF EXISTS public.get_last_played_faction_name(uuid);

-- New helper: most recent completed faction the user played in a lobby where
-- every given opponent (authenticated user_id) was also present.
CREATE OR REPLACE FUNCTION public.get_last_played_faction_vs_opponents(
  p_user_id uuid,
  p_opponent_ids uuid[]
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result text;
  v_opponent_count int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_opponent_count := COALESCE(array_length(p_opponent_ids, 1), 0);

  -- If there are no authenticated opponents to scope against, the rule does not apply.
  IF v_opponent_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT (lp.chosen_faction->>'name')
  INTO v_result
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.user_id = p_user_id
    AND l.status = 'completed'
    AND lp.chosen_faction IS NOT NULL
    AND (
      SELECT COUNT(DISTINCT lp2.user_id)
      FROM public.lobby_players lp2
      WHERE lp2.lobby_id = lp.lobby_id
        AND lp2.user_id = ANY(p_opponent_ids)
    ) = v_opponent_count
  ORDER BY l.created_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$function$;

-- Update claim_faction to use opponent-aware lookup
CREATE OR REPLACE FUNCTION public.claim_faction(p_lobby_id uuid, p_player_id uuid, p_faction jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_draft_mode text;
  v_factions jsonb;
  v_faction_name text;
  v_player_user_id uuid;
  v_already_taken int;
  v_in_pool int;
  v_last_faction text;
  v_other_choices int;
  v_opponents uuid[];
BEGIN
  SELECT settings INTO v_settings
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);
  v_faction_name := p_faction->>'name';

  IF v_faction_name IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_faction');
  END IF;

  SELECT COUNT(*) INTO v_in_pool
  FROM jsonb_array_elements(v_factions) f
  WHERE f->>'name' = v_faction_name;

  IF v_in_pool = 0 THEN
    RETURN jsonb_build_object('error', 'not_in_pool');
  END IF;

  SELECT user_id INTO v_player_user_id
  FROM public.lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_player_user_id IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*) INTO v_already_taken
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND id <> p_player_id
    AND chosen_faction IS NOT NULL
    AND chosen_faction->>'name' = v_faction_name;

  IF v_already_taken > 0 THEN
    RETURN jsonb_build_object('error', 'already_taken');
  END IF;

  IF v_draft_mode = 'free_no_repeat' AND v_player_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT lp.user_id), ARRAY[]::uuid[])
    INTO v_opponents
    FROM public.lobby_players lp
    WHERE lp.lobby_id = p_lobby_id
      AND lp.id <> p_player_id
      AND lp.user_id IS NOT NULL;

    v_last_faction := public.get_last_played_faction_vs_opponents(v_player_user_id, v_opponents);

    IF v_last_faction IS NOT NULL AND v_last_faction = v_faction_name THEN
      SELECT COUNT(*) INTO v_other_choices
      FROM jsonb_array_elements(v_factions) f
      WHERE f->>'name' <> v_last_faction
        AND NOT EXISTS (
          SELECT 1 FROM public.lobby_players lp
          WHERE lp.lobby_id = p_lobby_id
            AND lp.id <> p_player_id
            AND lp.chosen_faction IS NOT NULL
            AND lp.chosen_faction->>'name' = (f->>'name')
        );
      IF v_other_choices > 0 THEN
        RETURN jsonb_build_object('error', 'previous_faction');
      END IF;
    END IF;
  END IF;

  UPDATE public.lobby_players
  SET chosen_faction = p_faction,
      assigned_factions = jsonb_build_array(p_faction),
      token_picks = ARRAY[0]
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- Update get_forbidden_tokens to use opponent-aware lookup
CREATE OR REPLACE FUNCTION public.get_forbidden_tokens(p_lobby_id uuid)
RETURNS integer[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_settings jsonb;
  v_draft_mode text;
  v_token_mapping jsonb;
  v_last_faction text;
  v_forbidden integer[];
  v_unclaimed_count int;
  v_forbidden_count int;
  v_all_picks integer[];
  v_opponents uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT settings, token_mapping INTO v_settings, v_token_mapping
  FROM public.lobbies WHERE id = p_lobby_id;

  IF v_settings IS NULL OR v_token_mapping IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  IF v_draft_mode <> 'token_no_repeat' THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lp.user_id), ARRAY[]::uuid[])
  INTO v_opponents
  FROM public.lobby_players lp
  WHERE lp.lobby_id = p_lobby_id
    AND lp.user_id IS NOT NULL
    AND lp.user_id <> v_user_id;

  v_last_faction := public.get_last_played_faction_vs_opponents(v_user_id, v_opponents);
  IF v_last_faction IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg((kv.key)::int), ARRAY[]::integer[])
  INTO v_forbidden
  FROM jsonb_each(v_token_mapping) kv
  WHERE kv.value->>'name' = v_last_faction;

  IF v_forbidden IS NULL OR array_length(v_forbidden, 1) IS NULL THEN
    RETURN ARRAY[]::integer[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT unnested), ARRAY[]::integer[])
  INTO v_all_picks
  FROM public.lobby_players lp,
       unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  SELECT COUNT(*) INTO v_unclaimed_count
  FROM jsonb_object_keys(v_token_mapping) k
  WHERE (k::int) <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  SELECT COUNT(*) INTO v_forbidden_count
  FROM unnest(v_forbidden) t
  WHERE t <> ALL(COALESCE(v_all_picks, ARRAY[]::integer[]));

  IF v_unclaimed_count > 0 AND v_forbidden_count >= v_unclaimed_count THEN
    RETURN ARRAY[]::integer[];
  END IF;

  RETURN v_forbidden;
END;
$function$;

-- ===== 20260430063933_9d4a255b-c996-4b49-8f90-82324d203988.sql =====
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

-- ===== 20260430064704_aae1b403-7b99-4e02-9f1c-d593005f361f.sql =====
ALTER TABLE public.lobby_players
  ADD COLUMN IF NOT EXISTS display_color text;

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
  v_color text;
  v_has_color boolean;
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
    v_has_color := v_item ? 'display_color';
    v_color := NULLIF(v_item->>'display_color', '');

    IF v_has_color THEN
      UPDATE public.lobby_players
      SET vp = v_vp, rank = v_rank, display_color = v_color
      WHERE id = v_player_id AND lobby_id = p_lobby_id;
    ELSE
      UPDATE public.lobby_players
      SET vp = v_vp, rank = v_rank
      WHERE id = v_player_id AND lobby_id = p_lobby_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ===== 20260430071627_9f78d128-da96-4774-9ae5-b994e7a11bb1.sql =====
-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Storage bucket for uploaded rules PDFs (private, admin-managed)
INSERT INTO storage.buckets (id, name, public)
VALUES ('rules-pdfs', 'rules-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: only admins can read/write rules PDFs
CREATE POLICY "Admins can read rules pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload rules pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update rules pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete rules pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'rules-pdfs' AND public.has_role(auth.uid(), 'admin'));

-- Sources: one row per uploaded PDF
CREATE TABLE public.rules_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  label text NOT NULL,
  filename text NOT NULL,
  page_count integer,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | processing | ready | error
  error text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rules_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rules sources"
ON public.rules_sources FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage rules sources"
ON public.rules_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_rules_sources_updated_at
BEFORE UPDATE ON public.rules_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chunks: embedded passages
CREATE TABLE public.rules_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.rules_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  page_start integer,
  page_end integer,
  section text,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rules_chunks ENABLE ROW LEVEL SECURITY;

-- Public read so the chat edge function can query without service role.
-- Content is non-sensitive (official rules). Writes are admin-only.
CREATE POLICY "Anyone can read rules chunks"
ON public.rules_chunks FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Admins manage rules chunks"
ON public.rules_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX rules_chunks_source_idx ON public.rules_chunks(source_id);
CREATE INDEX rules_chunks_embedding_idx ON public.rules_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Faction data proposals: regenerate-factions output for review/apply
CREATE TABLE public.faction_data_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal jsonb NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- pending | applied | discarded
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faction_data_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage faction proposals"
ON public.faction_data_proposals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RPC: top-k semantic search
CREATE OR REPLACE FUNCTION public.match_rules_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_label text,
  page_start int,
  page_end int,
  section text,
  content text,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.source_id, s.label AS source_label,
         c.page_start, c.page_end, c.section, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.rules_chunks c
  JOIN public.rules_sources s ON s.id = c.source_id
  WHERE s.status = 'ready' AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ===== 20260430075210_dbeab1ae-5c48-44b5-aa15-dde2fe44f5ae.sql =====
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

-- ===== 20260430081110_b2909829-8a43-45cf-9aa1-fc20c1abd15b.sql =====

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

-- ===== 20260430081933_67696c4d-0aa3-45c6-9d7c-aaf70ada66bc.sql =====
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

-- ===== 20260504134428_618b5d95-6d56-4566-bd6f-f7e75ff8cc56.sql =====
-- 1. Add game_date column
ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS game_date timestamptz;

-- 2. Validation trigger for new lobbies (must have a future game_date)
CREATE OR REPLACE FUNCTION public.lobbies_validate_game_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only enforce on inserts; allow legacy rows (NULL) to remain.
  IF TG_OP = 'INSERT' THEN
    IF NEW.game_date IS NULL THEN
      RAISE EXCEPTION 'game_date_required';
    END IF;
    IF NEW.game_date < now() - interval '1 day' THEN
      RAISE EXCEPTION 'game_date_must_be_future';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lobbies_game_date_validate ON public.lobbies;
CREATE TRIGGER lobbies_game_date_validate
BEFORE INSERT ON public.lobbies
FOR EACH ROW EXECUTE FUNCTION public.lobbies_validate_game_date();

-- 3. Auto-assign random factions for any incomplete players (callable by anyone)
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
      IF COALESCE(array_length(v_player.token_picks, 1), 0) >= v_picks_per_player THEN CONTINUE; END IF;

      v_new_picks := COALESCE(v_player.token_picks, ARRAY[]::int[]);
      v_new_factions := COALESCE(v_player.assigned_factions, '[]'::jsonb);

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

      UPDATE public.lobby_players
      SET token_picks = v_new_picks, assigned_factions = v_new_factions
      WHERE id = v_player.id;

      v_assigned := v_assigned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'assigned', v_assigned);
END;
$$;

-- 4. Clear a single player's pick (player themselves or host) — only when not locked
CREATE OR REPLACE FUNCTION public.clear_player_pick(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lobby_id uuid;
  v_player_user uuid;
  v_host uuid;
  v_game_date timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT lp.lobby_id, lp.user_id, l.host_user_id, l.game_date
  INTO v_lobby_id, v_player_user, v_host, v_game_date
  FROM public.lobby_players lp
  JOIN public.lobbies l ON l.id = lp.lobby_id
  WHERE lp.id = p_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user <> v_user_id AND v_host <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  UPDATE public.lobby_players
  SET token_picks = '{}'::int[],
      assigned_factions = '[]'::jsonb,
      chosen_faction = NULL
  WHERE id = p_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Update claim_token to enforce lock
CREATE OR REPLACE FUNCTION public.claim_token(p_lobby_id uuid, p_player_id uuid, p_token_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_token_mapping JSONB;
  v_faction JSONB;
  v_all_picks INTEGER[];
  v_picks_per_player INTEGER;
  v_current_picks INTEGER[];
  v_player_user_id UUID;
  v_settings JSONB;
  v_draft_mode TEXT;
  v_forbidden INTEGER[];
  v_game_date timestamptz;
BEGIN
  SELECT token_mapping, settings, (settings->>'picks_per_player')::int, game_date
  INTO v_token_mapping, v_settings, v_picks_per_player, v_game_date
  FROM lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_token_mapping IS NULL THEN
    RETURN jsonb_build_object('error', 'Lobby not found or no token mapping');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');

  SELECT COALESCE(token_picks, '{}'), user_id
  INTO v_current_picks, v_player_user_id
  FROM lobby_players WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_current_picks IS NULL THEN
    RETURN jsonb_build_object('error', 'Player not found in lobby');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized to claim for this player');
  END IF;

  IF array_length(v_current_picks, 1) >= v_picks_per_player THEN
    RETURN jsonb_build_object('error', 'Already picked maximum tokens');
  END IF;

  SELECT ARRAY_AGG(unnested) INTO v_all_picks
  FROM lobby_players lp, unnest(COALESCE(lp.token_picks, '{}')) AS unnested
  WHERE lp.lobby_id = p_lobby_id;

  IF p_token_id = ANY(COALESCE(v_all_picks, '{}')) THEN
    RETURN jsonb_build_object('error', 'Token already claimed');
  END IF;

  v_faction := v_token_mapping->(p_token_id::text);
  IF v_faction IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid token number');
  END IF;

  IF v_draft_mode = 'token_no_repeat' THEN
    v_forbidden := public.get_forbidden_tokens(p_lobby_id);
    IF p_token_id = ANY(COALESCE(v_forbidden, ARRAY[]::integer[])) THEN
      RETURN jsonb_build_object('error', 'previous_faction');
    END IF;
  END IF;

  UPDATE lobby_players
  SET token_picks = array_append(COALESCE(token_picks, '{}'), p_token_id),
      assigned_factions = COALESCE(assigned_factions, '[]'::jsonb) || jsonb_build_array(v_faction)
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true, 'faction', v_faction);
END;
$function$;

-- 6. Update claim_faction to enforce lock
CREATE OR REPLACE FUNCTION public.claim_faction(p_lobby_id uuid, p_player_id uuid, p_faction jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings jsonb;
  v_draft_mode text;
  v_factions jsonb;
  v_faction_name text;
  v_player_user_id uuid;
  v_already_taken int;
  v_in_pool int;
  v_last_faction text;
  v_other_choices int;
  v_opponents uuid[];
  v_game_date timestamptz;
BEGIN
  SELECT settings, game_date INTO v_settings, v_game_date
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
  END IF;

  v_draft_mode := COALESCE(v_settings->>'draft_mode', 'token');
  v_factions := COALESCE(v_settings->'factions', '[]'::jsonb);
  v_faction_name := p_faction->>'name';

  IF v_faction_name IS NULL THEN
    RETURN jsonb_build_object('error', 'invalid_faction');
  END IF;

  SELECT COUNT(*) INTO v_in_pool
  FROM jsonb_array_elements(v_factions) f
  WHERE f->>'name' = v_faction_name;

  IF v_in_pool = 0 THEN
    RETURN jsonb_build_object('error', 'not_in_pool');
  END IF;

  SELECT user_id INTO v_player_user_id
  FROM public.lobby_players
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  IF v_player_user_id IS NULL AND NOT FOUND THEN
    RETURN jsonb_build_object('error', 'player_not_found');
  END IF;

  IF v_player_user_id IS NOT NULL AND v_player_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  SELECT COUNT(*) INTO v_already_taken
  FROM public.lobby_players
  WHERE lobby_id = p_lobby_id
    AND id <> p_player_id
    AND chosen_faction IS NOT NULL
    AND chosen_faction->>'name' = v_faction_name;

  IF v_already_taken > 0 THEN
    RETURN jsonb_build_object('error', 'already_taken');
  END IF;

  IF v_draft_mode = 'free_no_repeat' AND v_player_user_id IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT lp.user_id), ARRAY[]::uuid[])
    INTO v_opponents
    FROM public.lobby_players lp
    WHERE lp.lobby_id = p_lobby_id
      AND lp.id <> p_player_id
      AND lp.user_id IS NOT NULL;

    v_last_faction := public.get_last_played_faction_vs_opponents(v_player_user_id, v_opponents);

    IF v_last_faction IS NOT NULL AND v_last_faction = v_faction_name THEN
      SELECT COUNT(*) INTO v_other_choices
      FROM jsonb_array_elements(v_factions) f
      WHERE f->>'name' <> v_last_faction
        AND NOT EXISTS (
          SELECT 1 FROM public.lobby_players lp
          WHERE lp.lobby_id = p_lobby_id
            AND lp.id <> p_player_id
            AND lp.chosen_faction IS NOT NULL
            AND lp.chosen_faction->>'name' = (f->>'name')
        );
      IF v_other_choices > 0 THEN
        RETURN jsonb_build_object('error', 'previous_faction');
      END IF;
    END IF;
  END IF;

  UPDATE public.lobby_players
  SET chosen_faction = p_faction,
      assigned_factions = jsonb_build_array(p_faction),
      token_picks = ARRAY[0]
  WHERE id = p_player_id AND lobby_id = p_lobby_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 7. Update reset_lobby_draft to enforce lock
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
  v_game_date timestamptz;
BEGIN
  SELECT host_user_id, settings, game_date INTO v_host_user_id, v_settings, v_game_date
  FROM public.lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF v_host_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_host_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('error', 'not_authorized');
  END IF;

  IF v_game_date IS NOT NULL AND v_game_date - interval '3 days' <= now() THEN
    RETURN jsonb_build_object('error', 'locked');
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

-- ===== 20260504135310_082d4a75-ebec-4c76-9d67-e83377643702.sql =====
CREATE OR REPLACE FUNCTION public.lobbies_validate_game_date()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.game_date IS NULL THEN
      RAISE EXCEPTION 'game_date_required';
    END IF;
    IF NEW.game_date < now() - interval '1 day' THEN
      RAISE EXCEPTION 'game_date_must_be_future';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only validate when game_date is actually changing
    IF NEW.game_date IS DISTINCT FROM OLD.game_date THEN
      IF NEW.game_date IS NULL THEN
        RAISE EXCEPTION 'game_date_required';
      END IF;
      IF NEW.game_date < now() THEN
        RAISE EXCEPTION 'game_date_must_be_future';
      END IF;
      -- Block edits once we are inside the 3-day lock window of the existing date
      IF OLD.game_date IS NOT NULL AND OLD.game_date - interval '3 days' <= now() THEN
        RAISE EXCEPTION 'lobby_locked';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- ===== 20260505073645_bc4d0150-fcf4-4556-8983-dfb82f97c631.sql =====
UPDATE public.rules_sources SET status='pending', error=NULL, chunk_count=0 WHERE status='processing';

-- ===== 20260505073857_ebf80d35-523f-4884-bf19-e6d95f3540ed.sql =====
UPDATE public.rules_sources SET status='pending', error=NULL, chunk_count=0 WHERE status IN ('processing','error');

-- ===== 20260505074202_627119b5-aebf-4d84-a0f4-1cd2c0b3d034.sql =====
CREATE TABLE public.faction_data_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_name text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  applied_by uuid,
  applied_from_proposal uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faction_data_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read faction overrides"
ON public.faction_data_overrides FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins manage faction overrides"
ON public.faction_data_overrides FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_faction_overrides_updated_at
BEFORE UPDATE ON public.faction_data_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260507065742_4ab081bb-d236-4752-9bd4-34e6ec308ba6.sql =====
ALTER TABLE public.lobbies ADD COLUMN IF NOT EXISTS custom_map jsonb;

-- ===== 20260507082930_dedfd89a-72b2-46a0-8467-9815e865999a.sql =====
CREATE TABLE public.map_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.map_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
ON public.map_templates FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates"
ON public.map_templates FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON public.map_templates FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON public.map_templates FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_map_templates_updated_at
BEFORE UPDATE ON public.map_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_map_templates_user ON public.map_templates(user_id, updated_at DESC);

-- ===== 20260508063750_ca2f0cdc-03fd-4387-a2ee-c978262a4ef1.sql =====
ALTER TABLE public.lobbies DROP CONSTRAINT lobbies_status_check; ALTER TABLE public.lobbies ADD CONSTRAINT lobbies_status_check CHECK (status = ANY (ARRAY['waiting'::text, 'ready'::text, 'in_progress'::text, 'completed'::text]));

-- ===== 20260720134835_b5d7535a-1849-4cb7-ab03-b4ca19582e27.sql =====

-- 1. Drop unused host_password column (was legacy, no client code uses it)
ALTER TABLE public.lobbies DROP COLUMN IF EXISTS host_password;

-- 2. Restrict lobbies SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read lobbies" ON public.lobbies;
CREATE POLICY "Authenticated users can read lobbies"
  ON public.lobbies FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.lobbies FROM anon;

-- 3. Restrict lobby_players SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can read lobby players" ON public.lobby_players;
CREATE POLICY "Authenticated users can read lobby players"
  ON public.lobby_players FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.lobby_players FROM anon;

-- 4. Restrict profiles SELECT to authenticated
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.profiles FROM anon;

-- 5. Restrict rules_sources SELECT to authenticated (hides uploaded_by from public)
DROP POLICY IF EXISTS "Anyone can view rules sources" ON public.rules_sources;
CREATE POLICY "Authenticated users can view rules sources"
  ON public.rules_sources FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.rules_sources FROM anon;

-- Also restrict rules_chunks to authenticated for consistency
DROP POLICY IF EXISTS "Anyone can read rules chunks" ON public.rules_chunks;
CREATE POLICY "Authenticated users can read rules chunks"
  ON public.rules_chunks FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.rules_chunks FROM anon;

-- 6. Remove duplicate user_roles SELECT policy
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;

-- 7. Revoke anonymous EXECUTE on SECURITY DEFINER functions that require sign-in
REVOKE EXECUTE ON FUNCTION public.start_game(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.end_game(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_seats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.shuffle_seats(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reset_lobby_draft(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_player_pick(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.clear_tile_control(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_tile_control(uuid, integer, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_lobby_results(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_guest_data(text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_faction(uuid, uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_forbidden_tokens(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_last_played_faction_vs_opponents(uuid, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.match_rules_chunks(vector, integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.start_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shuffle_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_lobby_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_player_pick(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_tile_control(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tile_control(uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lobby_results(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_data(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_missing_factions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_link_guest_data(text[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_faction(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_token(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_forbidden_tokens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_played_faction_vs_opponents(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_rules_chunks(vector, integer) TO authenticated;

-- ===== 20260730234455_dbb590a9-a7c3-4513-bfe9-38baba80da32.sql =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobby_players TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rules_chunks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faction_data_overrides TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faction_data_proposals TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.faction_data_overrides TO anon;
GRANT ALL ON public.lobbies TO service_role;
GRANT ALL ON public.lobby_players TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.map_templates TO service_role;
GRANT ALL ON public.rules_sources TO service_role;
GRANT ALL ON public.rules_chunks TO service_role;
GRANT ALL ON public.faction_data_overrides TO service_role;
GRANT ALL ON public.faction_data_proposals TO service_role;
GRANT ALL ON public.user_roles TO service_role;

-- ===== 20260730235025_dee901da-ca51-4ff3-9431-9f3e7c659459.sql =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobby_players TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT ALL ON public.lobbies TO service_role;
GRANT ALL ON public.lobby_players TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- ===== 20261111120000_tighten_lobby_write_rules.sql =====
-- Tighten direct (REST) writes to lobbies and lobby_players.
--
-- Before: any player in a lobby could UPDATE every column of the lobby, and
-- every column of their own lobby_players row (token picks, assigned factions,
-- VP, rank...), bypassing the lock / uniqueness checks in the RPCs
-- (claim_token, claim_faction, ...). Any signed-in user could also take over
-- a lobby without a host.
--
-- After:
--  * Only the host (or an admin) can update a lobby directly. Players change
--    lobby state only through the SECURITY DEFINER RPCs, which keep working.
--  * On their own player row, a non-host may only change chosen_faction (and
--    only to one of their assigned factions), display_color, or link a guest
--    row to their own account (user_id NULL -> self).
--  * A non-host joining a lobby must insert a "blank" row (no picks/results).
--  * Hosts, admins and the RPCs (which run as the function owner) are not
--    restricted by the trigger.

-- 1. Lobbies: host/admin only for direct updates
DROP POLICY IF EXISTS "Hosts and players can update their lobby" ON public.lobbies;
CREATE POLICY "Hosts can update their lobby" ON public.lobbies
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = host_user_id OR public.has_role(auth.uid(), 'admin'));

-- Guest-lobby claiming goes through claim_guest_data(); no direct takeover.
DROP POLICY IF EXISTS "Authenticated users can claim unclaimed lobbies" ON public.lobbies;

-- 2. lobby_players: restrict which columns non-hosts may write
CREATE OR REPLACE FUNCTION public.lobby_players_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_host boolean;
BEGIN
  -- Only police direct API calls. SECURITY DEFINER RPCs run as their owner,
  -- and the service role / SQL editor are trusted.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  SELECT (l.host_user_id = v_uid) INTO v_is_host
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

  IF NEW.chosen_faction IS DISTINCT FROM OLD.chosen_faction
     AND NEW.chosen_faction IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(OLD.assigned_factions, '[]'::jsonb)) f
       WHERE f->>'name' = NEW.chosen_faction->>'name'
     ) THEN
    RAISE EXCEPTION 'not_allowed: faction was not assigned to you';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lobby_players_guard ON public.lobby_players;
CREATE TRIGGER lobby_players_guard
  BEFORE INSERT OR UPDATE ON public.lobby_players
  FOR EACH ROW EXECUTE FUNCTION public.lobby_players_guard();

-- ===== 20261111130000_fix_game_date_lock_trigger.sql =====
-- Bug fix: lobbies_validate_game_date() has an UPDATE branch (block moving the
-- game date inside the 3-day lock window, or into the past), but the trigger
-- was only created for INSERT, so that branch never ran.
DROP TRIGGER IF EXISTS lobbies_game_date_validate ON public.lobbies;
CREATE TRIGGER lobbies_game_date_validate
  BEFORE INSERT OR UPDATE OF game_date ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.lobbies_validate_game_date();

-- ===== 20261111140000_autopick_race_at_lock.sql =====
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
