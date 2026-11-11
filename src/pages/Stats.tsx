import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Swords, Users, Crown } from "lucide-react";
import StarField from "@/components/StarField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGameHistory } from "@/hooks/useGameHistory";
import { useOnlineGameHistory } from "@/hooks/useOnlineGameHistory";
import { resolveDisplayColor } from "@/lib/playerColors";
import type { GameRecord } from "@/types/gameHistory";

interface FactionStat {
  name: string;
  color: string;
  games: number;
  wins: number;
  winRate: number;
  avgVp: number;
}

interface PlayerStat {
  name: string;
  color: string | null;
  games: number;
  wins: number;
  winRate: number;
  avgVp: number;
  avgRank: number;
}

function computeFactionStats(history: GameRecord[]): FactionStat[] {
  // Sort newest first so the most recent color override "wins" per faction.
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const map = new Map<
    string,
    { color: string; games: number; wins: number; totalVp: number; latestOverride: string | null }
  >();

  for (const game of sorted) {
    for (const p of game.players) {
      const existing =
        map.get(p.faction.name) || {
          color: p.faction.color,
          games: 0,
          wins: 0,
          totalVp: 0,
          latestOverride: null as string | null,
        };
      existing.games++;
      existing.totalVp += p.vp;
      if (p.rank === 1) existing.wins++;
      if (existing.latestOverride === null && p.displayColor) {
        existing.latestOverride = p.displayColor;
      }
      map.set(p.faction.name, existing);
    }
  }

  return Array.from(map.entries())
    .map(([name, s]) => ({
      name,
      color: resolveDisplayColor(s.color, s.latestOverride),
      games: s.games,
      wins: s.wins,
      winRate: s.games > 0 ? (s.wins / s.games) * 100 : 0,
      avgVp: s.games > 0 ? s.totalVp / s.games : 0,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);
}

function computePlayerStats(history: GameRecord[]): PlayerStat[] {
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const map = new Map<
    string,
    {
      games: number;
      wins: number;
      totalVp: number;
      totalRank: number;
      latestColor: string | null;
    }
  >();

  for (const game of sorted) {
    for (const p of game.players) {
      const existing =
        map.get(p.player) || {
          games: 0,
          wins: 0,
          totalVp: 0,
          totalRank: 0,
          latestColor: null as string | null,
        };
      existing.games++;
      existing.totalVp += p.vp;
      existing.totalRank += p.rank;
      if (p.rank === 1) existing.wins++;
      if (existing.latestColor === null) {
        existing.latestColor = resolveDisplayColor(p.faction.color, p.displayColor);
      }
      map.set(p.player, existing);
    }
  }

  return Array.from(map.entries())
    .map(([name, s]) => ({
      name,
      color: s.latestColor,
      games: s.games,
      wins: s.wins,
      winRate: s.games > 0 ? (s.wins / s.games) * 100 : 0,
      avgVp: s.games > 0 ? s.totalVp / s.games : 0,
      avgRank: s.games > 0 ? s.totalRank / s.games : 0,
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
}

const Stats = () => {
  const navigate = useNavigate();
  const { history } = useGameHistory();
  const { games: onlineGames, loading } = useOnlineGameHistory();

  const allGames = useMemo(() => {
    // Merge local and online, deduplicate by id
    const map = new Map<string, GameRecord>();
    for (const g of history) map.set(g.id, g);
    for (const g of onlineGames) map.set(g.id, g);
    return Array.from(map.values());
  }, [history, onlineGames]);

  const factionStats = useMemo(() => computeFactionStats(allGames), [allGames]);
  const playerStats = useMemo(() => computePlayerStats(allGames), [allGames]);

  const totalGames = allGames.length;
  const totalLocal = history.length;
  const totalOnline = onlineGames.length;
  const topFaction = factionStats[0]?.name ?? "—";
  const topPlayer = playerStats[0]?.name ?? "—";

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-6 font-display text-sm uppercase tracking-[0.15em] text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Home
          </Button>

          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow text-center mb-2">
            Stats Dashboard
          </h1>
          <div className="imperial-divider w-48 mx-auto mb-8" />
        </motion.div>

        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center glass imperial-border rounded p-10">
            <p className="font-display text-lg text-muted-foreground uppercase tracking-[0.15em]">
              Loading stats…
            </p>
          </motion.div>
        ) : totalGames === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center glass imperial-border rounded p-10">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="font-display text-lg text-muted-foreground uppercase tracking-[0.15em]">
              No games recorded yet
            </p>
            <p className="text-base text-muted-foreground mt-2">
              Play some games and record results to see stats here.
            </p>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="glass imperial-border bg-transparent border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                    <Swords className="h-4 w-4" /> Games Played
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl text-primary text-glow">{totalGames}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {totalLocal} local · {totalOnline} online
                  </p>
                </CardContent>
              </Card>
              <Card className="glass imperial-border bg-transparent border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                    <Crown className="h-4 w-4" /> Top Faction
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-lg text-primary text-glow">{topFaction}</p>
                </CardContent>
              </Card>
              <Card className="glass imperial-border bg-transparent border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" /> Top Player
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-lg text-primary text-glow">{topPlayer}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="factions" className="w-full">
              <TabsList className="w-full glass imperial-border bg-transparent">
                <TabsTrigger value="factions" className="font-display text-sm uppercase tracking-[0.1em] flex-1 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Factions
                </TabsTrigger>
                <TabsTrigger value="players" className="font-display text-sm uppercase tracking-[0.1em] flex-1 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Players
                </TabsTrigger>
              </TabsList>

              <TabsContent value="factions">
                <div className="glass imperial-border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground">Faction</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Games</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Wins</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Win %</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Avg VP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {factionStats.map((f, i) => (
                        <TableRow key={f.name} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-sm flex-shrink-0"
                                style={{ background: `hsl(${f.color})` }}
                              />
                              <span className="font-display text-base text-foreground">{f.name}</span>
                              {i === 0 && <Crown className="h-4 w-4 text-primary" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-base text-foreground">{f.games}</TableCell>
                          <TableCell className="text-center text-base text-foreground">{f.wins}</TableCell>
                          <TableCell className="text-center text-base text-primary font-semibold">{f.winRate.toFixed(0)}%</TableCell>
                          <TableCell className="text-center text-base text-foreground">{f.avgVp.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="players">
                <div className="glass imperial-border rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground">Player</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Games</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Wins</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Win %</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Avg VP</TableHead>
                        <TableHead className="font-display text-sm uppercase tracking-[0.1em] text-muted-foreground text-center">Avg Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playerStats.map((p, i) => (
                        <TableRow key={p.name} className="border-border">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {p.color && (
                                <div
                                  className="w-4 h-4 rounded-sm flex-shrink-0"
                                  style={{ background: `hsl(${p.color})` }}
                                />
                              )}
                              <span className="font-display text-base text-foreground">{p.name}</span>
                              {i === 0 && <Trophy className="h-4 w-4 text-primary" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-base text-foreground">{p.games}</TableCell>
                          <TableCell className="text-center text-base text-foreground">{p.wins}</TableCell>
                          <TableCell className="text-center text-base text-primary font-semibold">{p.winRate.toFixed(0)}%</TableCell>
                          <TableCell className="text-center text-base text-foreground">{p.avgVp.toFixed(1)}</TableCell>
                          <TableCell className="text-center text-base text-foreground">{p.avgRank.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Stats;
