
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
