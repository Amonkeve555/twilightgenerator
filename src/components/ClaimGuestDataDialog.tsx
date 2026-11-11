import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/sessionId";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const CLAIMED_KEY = "ti4-guest-data-claimed";

export type ClaimGuestDataHandle = {
  /** Manually open the claim dialog, ignoring the once-per-device flag. */
  openManually: () => Promise<void>;
};

type GuestIdentity = {
  sessionId: string;
  names: string[];        // distinct player names ever used with this session ID
  hostedLobbies: number;  // lobbies hosted by this session ID (still unclaimed)
  playerSlots: number;    // player rows belonging to this session ID (still unclaimed)
};

type ClaimGuestDataResult = {
  success?: boolean;
  error?: string;
  hosted_lobbies?: number;
  player_slots?: number;
};

type ClaimGuestDataRpc = (
  fn: "claim_guest_data",
  args: { p_session_ids: string[] }
) => Promise<{ data: ClaimGuestDataResult | null; error: { message: string } | null }>;

const ClaimGuestDataDialog = forwardRef<ClaimGuestDataHandle>((_, ref) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [identities, setIdentities] = useState<GuestIdentity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deviceSessionId, setDeviceSessionId] = useState<string>("");

  /** Load all unclaimed guest identities (from any device). */
  const loadIdentities = useCallback(async () => {
    const localId = getSessionId();
    setDeviceSessionId(localId);

    // All player rows still unclaimed (user_id null)
    const { data: players } = await supabase
      .from("lobby_players")
      .select("session_id, player_name")
      .is("user_id", null);

    // All lobbies still unclaimed (host_user_id null)
    const { data: hosted } = await supabase
      .from("lobbies")
      .select("host_session_id, host_name")
      .is("host_user_id", null);

    const map = new Map<string, GuestIdentity>();
    for (const p of players ?? []) {
      if (!p.session_id) continue;
      const it = map.get(p.session_id) ?? { sessionId: p.session_id, names: [], hostedLobbies: 0, playerSlots: 0 };
      it.playerSlots++;
      if (p.player_name && !it.names.includes(p.player_name)) it.names.push(p.player_name);
      map.set(p.session_id, it);
    }
    for (const h of hosted ?? []) {
      if (!h.host_session_id) continue;
      const it = map.get(h.host_session_id) ?? { sessionId: h.host_session_id, names: [], hostedLobbies: 0, playerSlots: 0 };
      it.hostedLobbies++;
      if (h.host_name && !it.names.includes(h.host_name)) it.names.push(h.host_name);
      map.set(h.host_session_id, it);
    }

    // Sort: this device first, then most activity
    const list = Array.from(map.values()).sort((a, b) => {
      if (a.sessionId === localId) return -1;
      if (b.sessionId === localId) return 1;
      return (b.hostedLobbies + b.playerSlots) - (a.hostedLobbies + a.playerSlots);
    });
    setIdentities(list);

    // Pre-select the device session if present
    const pre = new Set<string>();
    if (list.some((x) => x.sessionId === localId)) pre.add(localId);
    setSelected(pre);
    return list;
  }, []);

  const checkAndOpen = useCallback(async (isManual: boolean) => {
    if (!user) {
      if (isManual) toast.error("Sign in first to claim guest data");
      return;
    }
    const list = await loadIdentities();
    if (list.length === 0) {
      localStorage.setItem(CLAIMED_KEY, user.id);
      if (isManual) toast.info("No unclaimed guest data found");
      return;
    }
    setManual(isManual);
    setOpen(true);
  }, [user, loadIdentities]);

  useImperativeHandle(ref, () => ({
    openManually: () => checkAndOpen(true),
  }), [checkAndOpen]);

  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem(CLAIMED_KEY) === user.id) return;
    checkAndOpen(false);
  }, [user, checkAndOpen]);

  const toggle = (sid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) {
        next.delete(sid);
      } else {
        next.add(sid);
      }
      return next;
    });
  };

  const claim = async () => {
    if (!user || selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpc = supabase.rpc as any;
      const res = await rpc("claim_guest_data", { p_session_ids: ids });
      const error = res?.error;
      const data = res?.data as ClaimGuestDataResult | null | undefined;

      if (error) {
        console.error("claim_guest_data error:", error);
        toast.error(error.message ?? "Failed to claim guest data");
        return;
      }
      if (!data || !data.success) {
        toast.error(data?.error ?? "Failed to claim guest data");
        return;
      }

      localStorage.setItem(CLAIMED_KEY, user.id);
      toast.success(
        `Guest data claimed: ${data.hosted_lobbies ?? 0} hosted, ${data.player_slots ?? 0} player slots`
      );
      setOpen(false);
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      console.error("claim_guest_data threw:", e);
      toast.error(e instanceof Error ? e.message : "Failed to claim guest data");
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    if (user && !manual) localStorage.setItem(CLAIMED_KEY, user.id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="glass imperial-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-lg uppercase tracking-[0.15em] text-primary">
            Claim Guest Data
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-muted-foreground">
            Select the guest identities that were you. Their lobbies, picks and game history will be linked to your account.
            <br />
            <span className="text-xs opacity-70">
              This device's session ID: <code className="text-primary">{deviceSessionId.slice(0, 8)}…</code>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-2 py-2">
          {identities.length === 0 && (
            <p className="font-body text-sm text-muted-foreground text-center py-4">
              No unclaimed guest activity found.
            </p>
          )}
          {identities.map((it) => {
            const isThisDevice = it.sessionId === deviceSessionId;
            const isSelected = selected.has(it.sessionId);
            return (
              <button
                key={it.sessionId}
                type="button"
                onClick={() => toggle(it.sessionId)}
                className={`w-full text-left rounded border p-3 transition ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-body text-sm text-foreground truncate">
                      {it.names.length > 0 ? it.names.join(", ") : "(no name)"}
                    </div>
                    <div className="font-body text-xs text-muted-foreground">
                      {it.hostedLobbies > 0 && <>Host of {it.hostedLobbies} {it.hostedLobbies === 1 ? "lobby" : "lobbies"} · </>}
                      {it.playerSlots} player {it.playerSlots === 1 ? "slot" : "slots"}
                    </div>
                    <div className="font-body text-[10px] text-muted-foreground/70 mt-1">
                      <code>{it.sessionId.slice(0, 12)}…</code>
                      {isThisDevice && <span className="ml-2 text-primary">· this device</span>}
                    </div>
                  </div>
                  <div className={`mt-1 h-4 w-4 rounded-sm border ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`} />
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={dismiss} disabled={busy} className="font-display text-xs uppercase tracking-[0.15em]">
            Cancel
          </Button>
          <Button
            onClick={claim}
            disabled={busy || selected.size === 0}
            className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? "Claiming..." : `Claim ${selected.size > 0 ? `(${selected.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

ClaimGuestDataDialog.displayName = "ClaimGuestDataDialog";

export default ClaimGuestDataDialog;
