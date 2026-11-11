/**
 * Lobby lock helpers — picks freeze 3 days before the scheduled game date.
 */
const LOCK_OFFSET_MS = 3 * 24 * 60 * 60 * 1000;

export function getLockTime(gameDate: string | null | undefined): Date | null {
  if (!gameDate) return null;
  const d = new Date(gameDate);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() - LOCK_OFFSET_MS);
}

export function isLocked(gameDate: string | null | undefined, now: Date = new Date()): boolean {
  const lock = getLockTime(gameDate);
  if (!lock) return false;
  return now.getTime() >= lock.getTime();
}

export function formatTimeUntilLock(gameDate: string | null | undefined, now: Date = new Date()): string | null {
  const lock = getLockTime(gameDate);
  if (!lock) return null;
  const diff = lock.getTime() - now.getTime();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days >= 1) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

export function formatGameDate(gameDate: string | null | undefined): string {
  if (!gameDate) return "—";
  const d = new Date(gameDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
