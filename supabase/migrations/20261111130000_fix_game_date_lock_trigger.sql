-- Bug fix: lobbies_validate_game_date() has an UPDATE branch (block moving the
-- game date inside the 3-day lock window, or into the past), but the trigger
-- was only created for INSERT, so that branch never ran.
DROP TRIGGER IF EXISTS lobbies_game_date_validate ON public.lobbies;
CREATE TRIGGER lobbies_game_date_validate
  BEFORE INSERT OR UPDATE OF game_date ON public.lobbies
  FOR EACH ROW EXECUTE FUNCTION public.lobbies_validate_game_date();
