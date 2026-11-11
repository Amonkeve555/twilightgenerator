import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Check, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import FactionPool from "@/components/FactionPool";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/sessionId";
import { generateInviteCode } from "@/lib/inviteCode";
import { TI4_FACTIONS, POK_FACTIONS, type Faction } from "@/data/factions";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import type { DraftMode } from "@/hooks/useLobby";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DRAFT_MODES: { value: DraftMode; label: string; desc: string }[] = [
  { value: "token", label: "Token Draft", desc: "Players pick numbered tokens; factions revealed on game day." },
  { value: "token_no_repeat", label: "Token Draft · No Repeat", desc: "Same as Token Draft, but blocks the faction each player played last game." },
  { value: "free", label: "Free Pick", desc: "Players directly claim any available faction in the lobby." },
  { value: "free_no_repeat", label: "Free Pick · No Repeat", desc: "Same as Free Pick, but blocks the faction each player played last game." },
];

const CreateLobby = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [hostName, setHostName] = useState("");
  const [gameDate, setGameDate] = useState<Date | undefined>(undefined);
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [picksPerPlayer, setPicksPerPlayer] = useState(1);
  const [draftMode, setDraftMode] = useState<DraftMode>("token");
  const [includePok, setIncludePok] = useState(false);
  const [excludedFactions, setExcludedFactions] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isFreeMode = draftMode === "free" || draftMode === "free_no_repeat";
  const effectivePicksPerPlayer = isFreeMode ? 1 : picksPerPlayer;

  // Default host name from profile nickname
  const effectiveHostName = hostName.trim() || profile?.nickname || "Host";

  const availableFactions = useMemo(() => {
    return [...TI4_FACTIONS, ...(includePok ? POK_FACTIONS : [])].filter(
      (f) => !excludedFactions.has(f.name)
    );
  }, [includePok, excludedFactions]);

  const canCreate = availableFactions.length >= maxPlayers * effectivePicksPerPlayer && !!gameDate;

  const toggleFaction = useCallback((name: string) => {
    setExcludedFactions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const createLobby = async () => {
    if (!user || !gameDate) return;
    setCreating(true);
    const code = generateInviteCode();
    const sessionId = getSessionId();

    const isFree = draftMode === "free" || draftMode === "free_no_repeat";

    let tokenMapping: Record<string, Faction> | null = null;
    if (!isFree) {
      const shuffled = [...availableFactions].sort(() => Math.random() - 0.5);
      tokenMapping = {};
      shuffled.forEach((f, i) => (tokenMapping![String(i + 1)] = f));
    }

    const settings = {
      factions: availableFactions,
      picks_per_player: effectivePicksPerPlayer,
      max_players: maxPlayers,
      draft_mode: draftMode,
    };

    const { error } = await supabase.from("lobbies").insert([{
      invite_code: code,
      host_session_id: sessionId, // legacy (kept NOT NULL in schema)
      host_user_id: user.id,
      host_name: effectiveHostName,
      
      settings: JSON.parse(JSON.stringify(settings)),
      token_mapping: tokenMapping ? JSON.parse(JSON.stringify(tokenMapping)) : null,
      game_date: gameDate.toISOString(),
    }]);

    if (error) {
      console.error(error);
      toast.error(error.message);
      setCreating(false);
      return;
    }

    setCreatedCode(code);
    setCreating(false);
  };

  const copyLink = () => {
    const url = `${window.location.origin}/join/${createdCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Create Game Lobby
          </h1>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        {!createdCode ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass imperial-border rounded p-6 space-y-6 mb-6">
              <div className="space-y-3">
                <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
                  Game Date <span className="text-destructive">*</span>
                </h2>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-body bg-input border-border hover:border-primary/40",
                        !gameDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {gameDate ? format(gameDate, "PPP") : "Pick the date you'll play"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={gameDate}
                      onSelect={setGameDate}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="font-body text-xs text-muted-foreground">
                  Picks lock 3 days before this date. Anyone without a faction is auto-assigned a random one.
                </p>
              </div>

              <div className="imperial-divider" />

              <div className="space-y-3">
                <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
                  Lobby Name
                </h2>
                <Input
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  placeholder={profile?.nickname ?? "Host"}
                  className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
                />
                <p className="font-body text-xs text-muted-foreground">
                  Leave blank to use your nickname.
                </p>
              </div>

              <div className="imperial-divider" />

              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
                  Max Players
                </h2>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <Button
                      key={n}
                      variant={maxPlayers === n ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaxPlayers(n)}
                      className={`h-8 w-8 font-display text-sm ${
                        maxPlayers === n
                          ? "bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                      }`}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="imperial-divider" />

              <div className="space-y-3">
                <h2 className="font-display text-sm uppercase tracking-[0.2em] text-primary text-glow">
                  Draft Mode
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DRAFT_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setDraftMode(m.value)}
                      className={`text-left rounded p-3 border transition-colors ${
                        draftMode === m.value
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-primary/40"
                      }`}
                    >
                      <p className="font-display text-sm uppercase tracking-[0.1em] text-primary">
                        {m.label}
                      </p>
                      <p className="font-body text-xs text-muted-foreground mt-1">
                        {m.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {!isFreeMode && (
                <>
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
                          onClick={() => setPicksPerPlayer(n)}
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
                </>
              )}

              <div className="imperial-divider" />


              <FactionPool
                includePok={includePok}
                onIncludePokChange={setIncludePok}
                excludedFactions={excludedFactions}
                onToggleFaction={toggleFaction}
              />
            </div>

            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={createLobby}
                disabled={!canCreate || creating}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {creating ? "Creating..." : "Create Lobby"}
              </Button>
              {!gameDate && (
                <p className="text-destructive text-sm font-body">
                  Pick a game date to continue
                </p>
              )}
              {gameDate && availableFactions.length < maxPlayers * effectivePicksPerPlayer && (
                <p className="text-destructive text-sm font-body">
                  Not enough factions ({availableFactions.length}) for {maxPlayers} players × {effectivePicksPerPlayer} picks
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="glass imperial-border rounded p-6 text-center space-y-4">
              <p className="font-display text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Lobby Created! Share this link:
              </p>
              <div className="flex items-center gap-2 justify-center">
                <code className="font-body text-lg text-primary bg-secondary px-4 py-2 rounded">
                  {createdCode}
                </code>
                <Button variant="outline" size="icon" onClick={copyLink} className="border-border text-muted-foreground hover:text-primary hover:border-primary/40">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="font-body text-xs text-muted-foreground">
                {`${window.location.origin}/join/${createdCode}`}
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() => navigate(`/lobby/${createdCode}`)}
                size="lg"
                className="font-display text-sm uppercase tracking-[0.2em] glow-primary px-10 py-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Go to Lobby
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CreateLobby;
