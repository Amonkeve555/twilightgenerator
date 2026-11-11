import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Clock, Check, Trophy, Pencil, CalendarPlus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import StarField from "@/components/StarField";
import EditGameDateDialog from "@/components/EditGameDateDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isLocked, formatGameDate } from "@/lib/lobbyLock";
import type { LobbySettings } from "@/hooks/useLobby";

interface LobbyWithRole {
  id: string;
  invite_code: string;
  host_name: string;
  status: string;
  created_at: string;
  game_date: string | null;
  settings: LobbySettings;
  role: "host" | "player";
  player_count: number;
}

const MyLobbies = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [lobbies, setLobbies] = useState<LobbyWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LobbyWithRole | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchLobbies = async () => {
      const { data: hosted } = await supabase
        .from("lobbies")
        .select("*")
        .eq("host_user_id", user.id)
        .order("created_at", { ascending: false });

      const { data: joined } = await supabase
        .from("lobby_players")
        .select("lobby_id")
        .eq("user_id", user.id);

      const joinedIds = (joined ?? []).map((j) => j.lobby_id);
      
      let playerLobbies: typeof hosted = [];
      if (joinedIds.length > 0) {
        const { data } = await supabase
          .from("lobbies")
          .select("*")
          .in("id", joinedIds)
          .order("created_at", { ascending: false });
        playerLobbies = data ?? [];
      }

      // Fetch player counts for all lobbies
      const allLobbyIds = [
        ...(hosted ?? []).map((l) => l.id),
        ...(playerLobbies ?? []).map((l) => l.id),
      ];
      const uniqueIds = [...new Set(allLobbyIds)];

      let countMap: Record<string, number> = {};
      if (uniqueIds.length > 0) {
        const { data: counts } = await supabase
          .from("lobby_players")
          .select("lobby_id")
          .in("lobby_id", uniqueIds);
        
        (counts ?? []).forEach((c) => {
          countMap[c.lobby_id] = (countMap[c.lobby_id] ?? 0) + 1;
        });
      }

      const hostedSet = new Set((hosted ?? []).map((l) => l.id));
      const merged = new Map<string, LobbyWithRole>();

      for (const l of hosted ?? []) {
        merged.set(l.id, {
          ...l,
          settings: l.settings as unknown as LobbySettings,
          role: "host",
          player_count: countMap[l.id] ?? 0,
        });
      }
      for (const l of playerLobbies ?? []) {
        if (!merged.has(l.id)) {
          merged.set(l.id, {
            ...l,
            settings: l.settings as unknown as LobbySettings,
            role: hostedSet.has(l.id) ? "host" : "player",
            player_count: countMap[l.id] ?? 0,
          });
        }
      }

      const sorted = [...merged.values()].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setLobbies(sorted);
      setLoading(false);
    };

    fetchLobbies();
  }, [user]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <Trophy className="h-4 w-4 text-primary" />;
      case "ready": return <Check className="h-4 w-4 text-green-400" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Completed";
      case "ready": return "Ready";
      default: return "Waiting";
    }
  };

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            My Lobbies
          </h1>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {loading ? (
            <p className="text-center font-display text-primary text-glow">Loading...</p>
          ) : lobbies.length === 0 ? (
            <div className="glass imperial-border rounded p-6 text-center">
              <p className="font-body text-muted-foreground">No lobbies yet. Create one to get started!</p>
            </div>
          ) : (
            lobbies.map((l) => {
              const lobbyLocked = isLocked(l.game_date);
              const canEditDate = l.role === "host" && !lobbyLocked;
              return (
                <motion.div
                  key={l.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/lobby/${l.invite_code}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/lobby/${l.invite_code}`);
                    }
                  }}
                  className="w-full glass imperial-border rounded p-4 text-left transition-all hover:border-primary/60 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="font-body text-xs text-primary bg-secondary px-2 py-0.5 rounded">
                          {l.invite_code}
                        </code>
                        <span className="text-[10px] font-body uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                          {l.role}
                        </span>
                        {lobbyLocked && (
                          <span className="text-[10px] font-body uppercase tracking-wider px-2 py-0.5 rounded border border-amber-400/40 text-amber-400">
                            Locked
                          </span>
                        )}
                      </div>
                      <p className="font-display text-sm text-primary">
                        {l.host_name}'s game
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs font-body text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {l.player_count}/{l.settings.max_players}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {l.game_date ? formatGameDate(l.game_date) : "No date set"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canEditDate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(l);
                          }}
                          className="h-7 px-2 border-border text-muted-foreground hover:text-primary hover:border-primary/40 font-body text-xs"
                        >
                          {l.game_date ? (
                            <>
                              <Pencil className="h-3 w-3 mr-1" />
                              Date
                            </>
                          ) : (
                            <>
                              <CalendarPlus className="h-3 w-3 mr-1" />
                              Set date
                            </>
                          )}
                        </Button>
                      )}
                      {statusIcon(l.status)}
                      <span className="font-body text-xs text-muted-foreground">{statusLabel(l.status)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}

          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              className="font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              <ArrowLeft className="mr-2 h-3 w-3" />
              Home
            </Button>
          </div>
        </motion.div>
      </div>
      {editing && (
        <EditGameDateDialog
          lobbyId={editing.id}
          currentDate={editing.game_date}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={(iso) => {
            setLobbies((prev) =>
              prev.map((x) => (x.id === editing.id ? { ...x, game_date: iso } : x))
            );
          }}
        />
      )}
    </div>
  );
};

export default MyLobbies;
