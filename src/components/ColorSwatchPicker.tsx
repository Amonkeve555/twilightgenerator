import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAYER_COLOR_PALETTE } from "@/lib/playerColors";

interface ColorSwatchPickerProps {
  value: string | null | undefined;
  factionDefault: string;
  onChange: (value: string | null) => void;
  size?: "sm" | "md";
  className?: string;
}

const ColorSwatchPicker = ({
  value,
  factionDefault,
  onChange,
  size = "md",
  className,
}: ColorSwatchPickerProps) => {
  const dim = size === "sm" ? "w-5 h-5" : "w-7 h-7";
  const palette = [
    { name: "Faction default", value: null as string | null, color: factionDefault },
    ...PLAYER_COLOR_PALETTE.map((p) => ({ name: p.name, value: p.value, color: p.value })),
  ];

  const isSelected = (v: string | null) =>
    (value ?? null) === v || (v === null && !value);

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {palette.map((p, i) => {
        const selected = isSelected(p.value);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(p.value)}
            aria-label={p.name}
            title={p.name}
            className={cn(
              dim,
              "rounded-sm border transition-all flex items-center justify-center",
              selected
                ? "border-primary ring-2 ring-primary/40 scale-110"
                : "border-border hover:border-primary/60"
            )}
            style={{ backgroundColor: `hsl(${p.color})` }}
          >
            {selected && (
              <Check className="w-3 h-3 text-background drop-shadow" strokeWidth={3} />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ColorSwatchPicker;
