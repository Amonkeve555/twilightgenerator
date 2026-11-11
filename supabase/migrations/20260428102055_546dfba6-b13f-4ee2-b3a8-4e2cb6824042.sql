
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
