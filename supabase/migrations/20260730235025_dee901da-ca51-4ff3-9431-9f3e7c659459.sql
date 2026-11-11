GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobbies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lobby_players TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT ALL ON public.lobbies TO service_role;
GRANT ALL ON public.lobby_players TO service_role;
GRANT ALL ON public.profiles TO service_role;