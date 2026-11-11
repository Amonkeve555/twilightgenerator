import { motion } from "framer-motion";

interface TokenGridProps {
  totalTokens: number;
  takenTokens: Map<number, number>;
  players: string[];
  onSelectToken: (tokenId: number) => void;
  forbiddenTokens?: Set<number>;
}

const TokenGrid = ({ totalTokens, takenTokens, players, onSelectToken, forbiddenTokens }: TokenGridProps) => {
  const tokens = Array.from({ length: totalTokens }, (_, i) => i + 1);

  return (
    <div className="glass imperial-border rounded p-6">
      <p className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground mb-4 text-center">
        Choose thy token — each conceals a faction
      </p>
      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        {tokens.map((id) => {
          const ownerIndex = takenTokens.get(id);
          const isTaken = ownerIndex !== undefined;
          const isForbidden = !isTaken && !!forbiddenTokens?.has(id);
          const isDisabled = isTaken || isForbidden;

          return (
            <motion.button
              key={id}
              whileHover={!isDisabled ? { scale: 1.08, y: -2 } : undefined}
              whileTap={!isDisabled ? { scale: 0.95 } : undefined}
              onClick={() => !isDisabled && onSelectToken(id)}
              disabled={isDisabled}
              title={isForbidden ? "Faction you played last game" : undefined}
              className={`aspect-square rounded font-display text-base font-bold flex items-center justify-center transition-all duration-200 border ${
                isTaken
                  ? "bg-muted border-border opacity-30 cursor-not-allowed"
                  : isForbidden
                  ? "bg-muted border-destructive/40 opacity-40 cursor-not-allowed text-destructive"
                  : "bg-secondary border-border hover:border-primary/60 hover:glow-primary cursor-pointer text-primary"
              }`}
              style={
                !isDisabled
                  ? {
                      backgroundImage:
                        "linear-gradient(135deg, hsl(230 25% 14%) 0%, hsl(230 30% 11%) 100%)",
                    }
                  : undefined
              }
            >
              {isTaken ? (
                <span className="text-[10px] text-muted-foreground font-body truncate px-1">
                  {players[ownerIndex]?.split(" ")[0]?.slice(0, 4)}
                </span>
              ) : (
                <span>{id}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default TokenGrid;
