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