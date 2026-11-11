import { useState, useCallback } from "react";
import type { GameRecord } from "@/types/gameHistory";

const STORAGE_KEY = "ti4-game-history";

function loadHistory(): GameRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: GameRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function useGameHistory() {
  const [history, setHistory] = useState<GameRecord[]>(loadHistory);

  const addGame = useCallback((game: GameRecord) => {
    setHistory((prev) => {
      const next = [game, ...prev];
      saveHistory(next);
      return next;
    });
  }, []);

  const deleteGame = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const updateGame = useCallback(
    (
      id: string,
      updates: { vp: number; rank: number; displayColor?: string | null }[]
    ) => {
      setHistory((prev) => {
        const next = prev.map((g) => {
          if (g.id !== id) return g;
          return {
            ...g,
            players: g.players.map((p, i) => ({
              ...p,
              vp: updates[i]?.vp ?? p.vp,
              rank: updates[i]?.rank ?? p.rank,
              displayColor:
                updates[i]?.displayColor !== undefined
                  ? updates[i].displayColor
                  : p.displayColor,
            })),
          };
        });
        saveHistory(next);
        return next;
      });
    },
    []
  );

  return { history, addGame, deleteGame, updateGame, clearHistory };
}
