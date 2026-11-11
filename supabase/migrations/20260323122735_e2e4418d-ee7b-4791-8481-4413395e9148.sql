
-- Allow deleting lobbies
CREATE POLICY "Anyone can delete lobbies" ON public.lobbies FOR DELETE USING (true);

-- Allow deleting lobby players
CREATE POLICY "Anyone can delete lobby players" ON public.lobby_players FOR DELETE USING (true);
