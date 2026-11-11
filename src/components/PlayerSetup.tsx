import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";

interface PlayerSetupProps {
  players: string[];
  onPlayersChange: (players: string[]) => void;
  picksPerPlayer: number;
  onPicksPerPlayerChange: (picks: number) => void;
}

const PlayerSetup = ({ players, onPlayersChange, picksPerPlayer, onPicksPerPlayerChange }: PlayerSetupProps) => {
  const addPlayer = () => {
    if (players.length < 8) {
      onPlayersChange([...players, `Player ${players.length + 1}`]);
    }
  };

  const removePlayer = () => {
    if (players.length > 2) {
      onPlayersChange(players.slice(0, -1));
    }
  };

  const updatePlayer = (index: number, name: string) => {
    const updated = [...players];
    updated[index] = name;
    onPlayersChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
          Players
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={removePlayer}
            disabled={players.length <= 2}
            className="h-8 w-8 border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="font-display text-sm w-6 text-center text-primary">
            {players.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={addPlayer}
            disabled={players.length >= 8}
            className="h-8 w-8 border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {players.map((name, i) => (
          <Input
            key={i}
            value={name}
            onChange={(e) => updatePlayer(i, e.target.value)}
            className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
            placeholder={`Player ${i + 1}`}
          />
        ))}
      </div>

      <div className="imperial-divider" />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
          Picks per Player
        </h2>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <Button
              key={n}
              variant={picksPerPlayer === n ? "default" : "outline"}
              size="sm"
              onClick={() => onPicksPerPlayerChange(n)}
              className={`h-8 w-8 font-display text-sm ${
                picksPerPlayer === n
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              }`}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs font-body">
        Each player picks {picksPerPlayer} token{picksPerPlayer > 1 ? "s" : ""}, then chooses which faction to play
      </p>
    </div>
  );
};

export default PlayerSetup;
