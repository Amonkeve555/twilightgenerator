import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StarField from "@/components/StarField";
import MapSetupHex from "@/components/MapSetupHex";
import { supabase } from "@/integrations/supabase/client";
import { useLobby } from "@/hooks/useLobby";
import { useAuth } from "@/hooks/useAuth";
import { MAP_SETUPS, type HexCell, type HexRole, type MapSetup } from "@/data/mapSetups";
import {
  blankCustomMap,
  customMapToSetup,
  freeCanvasMap,
  setupToCustomMap,
  type CustomMap,
  type CustomMapCell,
} from "@/lib/customMap";
import {
  listMyTemplates,
  saveTemplate,
  type MapTemplate,
} from "@/lib/mapTemplates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlayerCount = 3 | 4 | 5 | 6 | 7 | 8;
type Brush = "mecatol" | "home" | "blue" | "red" | "hyperlane" | "empty" | "erase";

const BRUSH_LABELS: Record<Brush, string> = {
  mecatol: "Mecatol",
  home: "Home",
  blue: "Blue",
  red: "Red",
  hyperlane: "Hyperlane",
  empty: "Empty",
  erase: "Erase",
};

const BRUSH_COLORS: Record<Brush, string> = {
  mecatol: "hsl(190 80% 60%)",
  home: "hsl(42 85% 55%)",
  blue: "hsl(210 80% 65%)",
  red: "hsl(0 75% 60%)",
  hyperlane: "hsl(280 65% 65%)",
  empty: "hsl(220 25% 50%)",
  erase: "hsl(0 0% 70%)",
};

function clampCount(n: number): PlayerCount {
  if (n <= 3) return 3;
  if (n >= 8) return 8;
  return n as PlayerCount;
}

const MapEditor = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { lobby, loading } = useLobby(inviteCode);
  const { user } = useAuth();

  const [map, setMap] = useState<CustomMap | null>(null);
  const [brush, setBrush] = useState<Brush>("blue");
  const [labelInput, setLabelInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<MapTemplate[]>([]);

  useEffect(() => {
    if (!user) return;
    listMyTemplates().then(setTemplates).catch(() => {});
  }, [user?.id]);

  const refreshTemplates = async () => {
    if (!user) return;
    try {
      setTemplates(await listMyTemplates());
    } catch {
      /* ignore */
    }
  };

  const playerCount = clampCount(lobby?.settings?.max_players ?? 6);
  const isHost = !!user && lobby?.host_user_id === user.id;

  // Load existing map or default to official template for the player count.
  useEffect(() => {
    if (!lobby) return;
    if (map) return;
    if (lobby.custom_map) {
      setMap(lobby.custom_map);
    } else {
      setMap(setupToCustomMap(MAP_SETUPS[playerCount]));
    }
  }, [lobby, map, playerCount]);

  const setup: MapSetup | null = useMemo(
    () => (map ? customMapToSetup(map, playerCount) : null),
    [map, playerCount],
  );

  const paintCell = (q: number, r: number) => {
    if (!map) return;
    const idx = map.cells.findIndex((c) => c.q === q && c.r === r);
    if (brush === "erase") {
      if (idx < 0) return;
      const newCells = map.cells.filter((_, i) => i !== idx);
      setMap({ ...map, cells: newCells });
      return;
    }
    const next: CustomMapCell = {
      q,
      r,
      kind: brush as HexRole,
      label: labelInput.trim() || undefined,
    };
    const newCells = [...map.cells];
    if (idx >= 0) newCells[idx] = next;
    else newCells.push(next);
    setMap({ ...map, cells: newCells });
  };

  const loadTemplate = (count: PlayerCount) => {
    if (!confirm(`Replace current map with the official ${count}-player template?`)) return;
    setMap(setupToCustomMap(MAP_SETUPS[count]));
  };

  const loadBlank = (rings: 3 | 4) => {
    if (!confirm(`Replace current map with a blank ${rings}-ring grid?`)) return;
    setMap(blankCustomMap(rings));
  };

  const loadFreeCanvas = () => {
    if (!confirm("Replace current map with a blank free canvas?")) return;
    setMap(freeCanvasMap());
  };

  const loadFromTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    if (!confirm(`Load template "${tpl.name}"?`)) return;
    setMap(tpl.data);
  };

  const saveAsTemplate = async () => {
    if (!user) {
      toast.error("Sign in to save templates");
      return;
    }
    if (!map) return;
    const name = prompt("Template name:")?.trim();
    if (!name) return;
    try {
      await saveTemplate(name, map);
      toast.success(`Saved "${name}"`);
      await refreshTemplates();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  const save = async () => {
    if (!lobby || !map) return;
    setSaving(true);
    const { error } = await supabase
      .from("lobbies")
      .update({ custom_map: map as never })
      .eq("id", lobby.id);
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("Custom map saved");
    navigate(`/lobby/${inviteCode}`);
  };

  const clearOverride = async () => {
    if (!lobby) return;
    if (!confirm("Remove the custom map and revert to the official template?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("lobbies")
      .update({ custom_map: null })
      .eq("id", lobby.id);
    setSaving(false);
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
      return;
    }
    toast.success("Custom map removed");
    navigate(`/lobby/${inviteCode}`);
  };

  if (loading || !lobby) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass imperial-border rounded p-6 text-center">
          <p className="font-body text-foreground">Only the host can edit this map.</p>
          <Button
            variant="ghost"
            onClick={() => navigate(`/lobby/${inviteCode}`)}
            className="mt-3 font-display text-xs uppercase tracking-[0.2em]"
          >
            Back to lobby
          </Button>
        </div>
      </div>
    );
  }

  const handleTileClick = (q: number, r: number) => paintCell(q, r);

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(`/lobby/${inviteCode}`)}
          className="mb-4 font-display text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to lobby
        </Button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="imperial-divider w-48 mx-auto mb-3" />
          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow mb-1">
            Map Editor
          </h1>
          <p className="font-display text-xs uppercase tracking-[0.4em] text-muted-foreground">
            {lobby.invite_code} · paint hexes to design your galaxy
          </p>
          <div className="imperial-divider w-48 mx-auto mt-3" />
        </motion.div>

        {/* Templates */}
        <div className="glass imperial-border rounded p-4 mb-4">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-2">
            Base layout
          </p>
          <div className="flex flex-wrap gap-2">
            {([3, 4, 5, 6, 7, 8] as PlayerCount[]).map((n) => (
              <Button
                key={n}
                variant="outline"
                size="sm"
                onClick={() => loadTemplate(n)}
                className="font-display text-xs uppercase tracking-[0.15em]"
              >
                Official {n}p
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBlank(3)}
              className="font-display text-xs uppercase tracking-[0.15em]"
            >
              Blank 3-ring
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadBlank(4)}
              className="font-display text-xs uppercase tracking-[0.15em]"
            >
              Blank 4-ring
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFreeCanvas}
              className="font-display text-xs uppercase tracking-[0.15em]"
            >
              Free canvas
            </Button>
          </div>
          {templates.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
                Load template
              </span>
              <Select onValueChange={loadFromTemplate}>
                <SelectTrigger className="glass imperial-border h-8 font-body text-sm w-[240px]">
                  <SelectValue placeholder="Select a saved template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Brush */}
        <div className="glass imperial-border rounded p-4 mb-4 space-y-3">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-primary">
            Brush
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(BRUSH_LABELS) as Brush[]).map((b) => (
              <Button
                key={b}
                variant={brush === b ? "default" : "outline"}
                size="sm"
                onClick={() => setBrush(b)}
                className="font-display text-xs uppercase tracking-[0.15em] gap-2"
                style={
                  brush === b
                    ? { backgroundColor: BRUSH_COLORS[b], color: "hsl(220 30% 10%)" }
                    : undefined
                }
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: `${BRUSH_COLORS[b].replace(")", " / 0.5)")}`,
                    border: `1.5px solid ${BRUSH_COLORS[b]}`,
                  }}
                />
                {BRUSH_LABELS[b]}
              </Button>
            ))}
          </div>


          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
              Label (optional)
            </span>
            <Input
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value.slice(0, 20))}
              placeholder="e.g. Quann, Wormhole α…"
              className="glass imperial-border h-8 font-body text-sm"
            />
            {labelInput && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLabelInput("")}
                className="font-display text-xs"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Map */}
        {setup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass imperial-border rounded p-4 mb-4"
          >
            <MapSetupHex
              setup={setup}
              onTileClick={handleTileClick}
              neutral
              gridGuide={{ range: 6 }}
            />
            <p className="font-body text-xs text-muted-foreground/70 text-center italic mt-3">
              Click any hex to paint it with the active brush.
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            onClick={save}
            disabled={saving || !map}
            className="font-display text-xs uppercase tracking-[0.2em] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="mr-2 h-3 w-3" />
            Save & close
          </Button>
          <Button
            variant="outline"
            onClick={() => setMap(setupToCustomMap(MAP_SETUPS[playerCount]))}
            className="font-display text-xs uppercase tracking-[0.2em]"
          >
            <RotateCcw className="mr-2 h-3 w-3" />
            Reset to template
          </Button>
          <Button
            variant="outline"
            onClick={saveAsTemplate}
            disabled={!map}
            className="font-display text-xs uppercase tracking-[0.2em]"
          >
            <Save className="mr-2 h-3 w-3" />
            Save as template
          </Button>
          {lobby.custom_map && (
            <Button
              variant="outline"
              onClick={clearOverride}
              disabled={saving}
              className="font-display text-xs uppercase tracking-[0.2em] text-destructive border-destructive/40"
            >
              <Trash2 className="mr-2 h-3 w-3" />
              Remove custom map
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;
