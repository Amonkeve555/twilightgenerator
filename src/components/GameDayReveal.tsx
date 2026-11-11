import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FactionCard from "@/components/FactionCard";
import type { LobbyPlayerRow } from "@/hooks/useLobby";
import { getVisibleFaction } from "@/lib/reveal";

interface Props {
  lobbyId: string;
  players: LobbyPlayerRow[];
  /** Reveal has happened (game day / game started) */
  revealed: boolean;
}

const seenKey = (lobbyId: string) => `ti4-reveal-seen:${lobbyId}`;

function hasSeen(lobbyId: string): boolean {
  try {
    return localStorage.getItem(seenKey(lobbyId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(lobbyId: string) {
  try {
    localStorage.setItem(seenKey(lobbyId), "1");
  } catch {
    /* storage unavailable — the reveal just shows again next time */
  }
}

/**
 * Game-day moment: the first time a viewer opens the lobby after the reveal,
 * every player's race flips into view one after another.
 * Includes a small "Replay reveal" trigger for later.
 */
const GameDayReveal = ({ lobbyId, players, revealed }: Props) => {
  const [open, setOpen] = useState(false);
  // How many cards have flipped so far (they mount one by one so each flip is seen).
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (revealed && players.length > 0 && !hasSeen(lobbyId)) setOpen(true);
  }, [revealed, lobbyId, players.length]);

  useEffect(() => {
    if (!open) return;
    setShown(0);
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      n = 1;
      setShown(1);
      interval = setInterval(() => {
        n += 1;
        setShown(n);
        if (n >= players.length && interval) clearInterval(interval);
      }, 650);
    }, 900);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [open, players.length]);

  const close = () => {
    markSeen(lobbyId);
    setOpen(false);
  };

  if (!revealed) return null;

  const entries = players
    .map((p) => ({ p, f: getVisibleFaction(p, true) }))
    .filter((e): e is { p: LobbyPlayerRow; f: NonNullable<typeof e.f> } => !!e.f);

  return (
    <>
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className="font-display text-xs uppercase tracking-[0.2em] text-primary hover:bg-primary/10"
        >
          <Sparkles className="mr-2 h-3 w-3" />
          Replay reveal
        </Button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Game day reveal"
          >
            <div className="max-w-2xl mx-auto px-4 py-10 md:py-16">
              <div className="flex justify-end">
                <Button variant="ghost" size="icon" onClick={close} aria-label="Close reveal" className="text-muted-foreground hover:text-primary">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, letterSpacing: "0.6em" }}
                animate={{ opacity: 1, scale: 1, letterSpacing: "0.15em" }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="text-center mb-8"
              >
                <p className="font-display text-sm uppercase tracking-[0.4em] text-muted-foreground mb-2">
                  It's game day
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-black text-primary text-glow">
                  The Races Are Revealed
                </h2>
                <div className="imperial-divider w-48 mx-auto mt-4" />
              </motion.div>

              {entries.length === 0 ? (
                <p className="text-center font-body text-muted-foreground">No races were chosen in this lobby.</p>
              ) : (
                <div className="grid gap-3">
                  {entries.slice(0, shown).map(({ p, f }) => (
                    <FactionCard key={p.id} playerName={p.player_name} faction={f} index={0} />
                  ))}
                </div>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: shown >= entries.length ? 1 : 0 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center mt-8"
              >
                <Button
                  onClick={close}
                  size="lg"
                  className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  To the table
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameDayReveal;
