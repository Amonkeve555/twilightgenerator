import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface GameTimerProps {
  startedAt: string | null | undefined;
  endedAt: string | null | undefined;
  className?: string;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function formatDurationShort(startedAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return "0m";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const GameTimer = ({ startedAt, endedAt, className, compact }: GameTimerProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  if (!startedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const elapsed = end - start;
  const live = !endedAt;

  return (
    <div
      className={
        "inline-flex items-center gap-2 font-display tracking-[0.15em] uppercase " +
        (compact ? "text-xs " : "text-sm ") +
        (live ? "text-primary" : "text-muted-foreground") +
        " " +
        (className ?? "")
      }
      title={live ? "Game time (live)" : "Final game duration"}
    >
      <Clock className={`${compact ? "h-3 w-3" : "h-4 w-4"} ${live ? "animate-pulse" : ""}`} />
      <span className="tabular-nums">{formatDuration(elapsed)}</span>
      {live && <span className="text-[0.6rem] text-muted-foreground">LIVE</span>}
    </div>
  );
};

export default GameTimer;
