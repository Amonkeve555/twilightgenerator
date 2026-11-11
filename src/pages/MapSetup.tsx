import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, Trash2, Pencil, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StarField from "@/components/StarField";
import MapSetupHex from "@/components/MapSetupHex";
import { useAuth } from "@/hooks/useAuth";
import { MAP_SETUPS, type HexRole, type MapSetup } from "@/data/mapSetups";
import {
  blankCustomMap,
  customMapToSetup,
  freeCanvasMap,
  setupToCustomMap,
  type CustomMap,
  type CustomMapCell,
} from "@/lib/customMap";
import {
  deleteTemplate,
  listMyTemplates,
  saveTemplate,
  updateTemplate,
  type MapTemplate,
} from "@/lib/mapTemplates";

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

const MapTemplatesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [map, setMap] = useState<CustomMap>(() => setupToCustomMap(MAP_SETUPS[6]));
  const [brush, setBrush] = useState<Brush>("blue");
  const [labelInput, setLabelInput] = useState("");
  const [templates, setTemplates] = useState<MapTemplate[]>([]);
  const [loadingTpls, setLoadingTpls] = useState(false);
  const [currentTplId, setCurrentTplId] = useState<string | null>(null);

  const refreshTemplates = async () => {
    if (!user) {
      setTemplates([]);
      return;
    }
    setLoadingTpls(true);
    try {
      setTemplates(await listMyTemplates());
    } catch (e) {
      toast.error(`Failed to load templates: ${(e as Error).message}`);
    } finally {
      setLoadingTpls(false);
    }
  };

  useEffect(() => {
    refreshTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setup: MapSetup = useMemo(() => customMapToSetup(map, 6), [map]);

  const paintCell = (q: number, r: number) => {
    const idx = map.cells.findIndex((c) => c.q === q && c.r === r);
    if (brush === "erase") {
      if (idx < 0) return;
      setMap({ ...map, cells: map.cells.filter((_, i) => i !== idx) });
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
    setCurrentTplId(null);
  };

  const loadBlank = (rings: 3 | 4) => {
    if (!confirm(`Replace current map with a blank ${rings}-ring grid?`)) return;
    setMap(blankCustomMap(rings));
    setCurrentTplId(null);
  };

  const loadFreeCanvas = () => {
    if (!confirm("Replace current map with a blank free canvas?")) return;
    setMap(freeCanvasMap());
    setCurrentTplId(null);
  };

  const loadSavedTemplate = (tpl: MapTemplate) => {
    if (!confirm(`Load template "${tpl.name}"?`)) return;
    setMap(tpl.data);
    setCurrentTplId(tpl.id);
  };

  const saveAsNew = async () => {
    if (!user) {
      toast.error("Sign in to save templates");
      return;
    }
    const name = prompt("Template name:")?.trim();
    if (!name) return;
    try {
      const tpl = await saveTemplate(name, map);
      toast.success(`Saved "${name}"`);
      setCurrentTplId(tpl.id);
      await refreshTemplates();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`);
    }
  };

  const overwriteCurrent = async () => {
    if (!currentTplId) return;
    try {
      await updateTemplate(currentTplId, { data: map });
      toast.success("Template updated");
      await refreshTemplates();
    } catch (e) {
      toast.error(`Update failed: ${(e as Error).message}`);
    }
  };

  const renameTpl = async (tpl: MapTemplate) => {
    const name = prompt("New name:", tpl.name)?.trim();
    if (!name || name === tpl.name) return;
    try {
      await updateTemplate(tpl.id, { name });
      await refreshTemplates();
    } catch (e) {
      toast.error(`Rename failed: ${(e as Error).message}`);
    }
  };

  const removeTpl = async (tpl: MapTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await deleteTemplate(tpl.id);
      if (currentTplId === tpl.id) setCurrentTplId(null);
      await refreshTemplates();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4 font-display text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
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
            Design galaxies · save personal templates
          </p>
          <div className="imperial-divider w-48 mx-auto mt-3" />
        </motion.div>

        {/* Templates */}
        <div className="glass imperial-border rounded p-4 mb-4">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-primary mb-2">
            My Templates
          </p>
          {!user && (
            <p className="font-body text-sm text-muted-foreground">
              <button
                onClick={() => navigate("/auth")}
                className="text-primary hover:underline"
              >
                Sign in
              </button>{" "}
              to save and load your own templates.
            </p>
          )}
          {user && (
            <>
              <div className="flex flex-wrap gap-2 mb-2">
                <Button
                  size="sm"
                  onClick={saveAsNew}
                  className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="mr-2 h-3 w-3" />
                  Save as new
                </Button>
                {currentTplId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={overwriteCurrent}
                    className="font-display text-xs uppercase tracking-[0.15em]"
                  >
                    Overwrite current
                  </Button>
                )}
              </div>
              {loadingTpls ? (
                <p className="font-body text-xs text-muted-foreground">Loading…</p>
              ) : templates.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground italic">
                  No templates saved yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={`flex items-center gap-1 rounded border px-2 py-1 ${
                        currentTplId === tpl.id
                          ? "border-primary bg-primary/10"
                          : "border-border"
                      }`}
                    >
                      <button
                        onClick={() => loadSavedTemplate(tpl)}
                        className="font-display text-xs uppercase tracking-[0.15em] flex items-center gap-1"
                      >
                        <FolderOpen className="h-3 w-3" />
                        {tpl.name}
                      </button>
                      <button
                        onClick={() => renameTpl(tpl)}
                        className="text-muted-foreground hover:text-primary p-1"
                        title="Rename"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeTpl(tpl)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Base layouts */}
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass imperial-border rounded p-4"
        >
          <MapSetupHex
            setup={setup}
            onTileClick={paintCell}
            neutral
            gridGuide={{ range: 6 }}
          />
          <p className="font-body text-xs text-muted-foreground/70 text-center italic mt-3">
            Click any hex to paint it with the active brush.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default MapTemplatesPage;
