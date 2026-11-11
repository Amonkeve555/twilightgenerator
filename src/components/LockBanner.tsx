import { useEffect, useState } from "react";
import { Lock, AlertTriangle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { getLockTime, isLocked, formatGameDate } from "@/lib/lobbyLock";

interface LockBannerProps {
  gameDate: string | null | undefined;
  className?: string;
}

/**
 * Detailed countdown banner explaining when faction picks lock.
 * Auto-refreshes every 30s so the countdown stays current.
 */
const LockBanner = ({ gameDate, className = "" }: LockBannerProps) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!gameDate) return null;

  const lockTime = getLockTime(gameDate);
  if (!lockTime) return null;

  const locked = isLocked(gameDate, now);
  const diffMs = lockTime.getTime() - now.getTime();

  // Build precise countdown
  const abs = Math.abs(diffMs);
  const days = Math.floor(abs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((abs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((abs % (60 * 60 * 1000)) / (60 * 1000));

  const countdown =
    days > 0
      ? `${days}d ${hours}h ${minutes}m`
      : hours > 0
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;

  // Urgency tier (only when not locked)
  const urgent = !locked && diffMs < 24 * 60 * 60 * 1000; // < 1 day
  const soon = !locked && !urgent && diffMs < 3 * 24 * 60 * 60 * 1000; // shouldn't really hit, lock = 3d

  const lockDateLabel = lockTime.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (locked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass imperial-border rounded-lg px-4 py-3 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-left">
            <p className="font-display text-sm uppercase tracking-[0.2em] text-amber-400">
              Picks Locked
            </p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Faction picks are frozen — game is within 3 days
              {gameDate && (
                <>
                  {" "}of <span className="text-primary">{formatGameDate(gameDate)}</span>
                </>
              )}
              . Players without a pick have been auto-assigned a random faction.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass imperial-border rounded-lg px-4 py-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {urgent ? (
          <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
        ) : (
          <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        )}
        <div className="text-left flex-1">
          <p
            className={`font-display text-sm uppercase tracking-[0.2em] ${
              urgent ? "text-red-400" : "text-primary"
            }`}
          >
            Picks lock in {countdown}
          </p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            You can change or pick your faction until{" "}
            <span className="text-primary">{lockDateLabel}</span>
            {soon ? "" : ""}. After that, picks are frozen and any missing
            faction is auto-assigned at random.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default LockBanner;
