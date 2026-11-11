import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Link2, Search, Shield, Users as UsersIcon, Ghost, BookOpen, Sparkles } from "lucide-react";
import RulesSourcesPanel from "@/components/admin/RulesSourcesPanel";
import FactionDataPanel from "@/components/admin/FactionDataPanel";
import { motion } from "framer-motion";
import { toast } from "sonner";
import StarField from "@/components/StarField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  full_name: string | null;
  nickname: string | null;
};

type GuestIdentity = {
  sessionId: string;
  names: string[];
  hostedLobbies: number;
  playerSlots: number;
};

type LinkMode =
  | { kind: "guest-to-user"; guest: GuestIdentity }
  | { kind: "user-to-guests"; user: AdminUser }
  | null;

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [identities, setIdentities] = useState<GuestIdentity[]>([]);
  const [loading, setLoading] = useState(true);

  const [userQuery, setUserQuery] = useState("");
  const [guestQuery, setGuestQuery] = useState("");

  const [linkMode, setLinkMode] = useState<LinkMode>(null);
  const [pickedUserId, setPickedUserId] = useState<string>("");
  const [pickedGuestIds, setPickedGuestIds] = useState<string[]>([]);
  const [dialogQuery, setDialogQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate("/", { replace: true });
  }, [roleLoading, isAdmin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, playersRes, lobbiesRes] = await Promise.all([
        supabase.rpc("admin_list_users"),
        supabase.from("lobby_players").select("session_id, player_name").is("user_id", null),
        supabase.from("lobbies").select("host_session_id, host_name").is("host_user_id", null),
      ]);

      if (usersRes.error) {
        console.error("admin_list_users failed:", usersRes.error);
        toast.error(`Users: ${usersRes.error.message}`);
      } else if (usersRes.data) {
        setUsers(usersRes.data as AdminUser[]);
      }

      if (playersRes.error) console.error("lobby_players query failed:", playersRes.error);
      if (lobbiesRes.error) console.error("lobbies query failed:", lobbiesRes.error);

      const map = new Map<string, GuestIdentity>();
      for (const p of playersRes.data ?? []) {
        if (!p.session_id) continue;
        const it = map.get(p.session_id) ?? { sessionId: p.session_id, names: [], hostedLobbies: 0, playerSlots: 0 };
        it.playerSlots++;
        if (p.player_name && !it.names.includes(p.player_name)) it.names.push(p.player_name);
        map.set(p.session_id, it);
      }
      for (const h of lobbiesRes.data ?? []) {
        if (!h.host_session_id) continue;
        const it = map.get(h.host_session_id) ?? { sessionId: h.host_session_id, names: [], hostedLobbies: 0, playerSlots: 0 };
        it.hostedLobbies++;
        if (h.host_name && !it.names.includes(h.host_name)) it.names.push(h.host_name);
        map.set(h.host_session_id, it);
      }
      setIdentities(
        Array.from(map.values()).sort(
          (a, b) => (b.hostedLobbies + b.playerSlots) - (a.hostedLobbies + a.playerSlots)
        )
      );
    } catch (e) {
      console.error("Admin load failed:", e);
      toast.error(e instanceof Error ? e.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.nickname?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const filteredGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return identities;
    return identities.filter(
      (g) =>
        g.sessionId.toLowerCase().includes(q) ||
        g.names.some((n) => n.toLowerCase().includes(q))
    );
  }, [identities, guestQuery]);

  const userLabel = (u: AdminUser) =>
    u.nickname || u.full_name || u.email || u.id.slice(0, 8);

  const openGuestLink = (guest: GuestIdentity) => {
    setLinkMode({ kind: "guest-to-user", guest });
    setPickedUserId("");
    setDialogQuery("");
  };

  const openUserLink = (user: AdminUser) => {
    setLinkMode({ kind: "user-to-guests", user });
    setPickedGuestIds([]);
    setDialogQuery("");
  };

  const closeLink = () => {
    setLinkMode(null);
    setPickedUserId("");
    setPickedGuestIds([]);
    setDialogQuery("");
  };

  const performLink = async () => {
    if (!linkMode) return;
    let sessionIds: string[] = [];
    let targetUserId = "";
    if (linkMode.kind === "guest-to-user") {
      if (!pickedUserId) return;
      sessionIds = [linkMode.guest.sessionId];
      targetUserId = pickedUserId;
    } else {
      if (pickedGuestIds.length === 0) return;
      sessionIds = pickedGuestIds;
      targetUserId = linkMode.user.id;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("admin_link_guest_data", {
        p_session_ids: sessionIds,
        p_target_user_id: targetUserId,
      });
      if (error) throw error;
      const payload = data as { success?: boolean; error?: string; hosted_lobbies?: number; player_slots?: number } | null;
      if (!payload?.success) {
        toast.error(payload?.error ?? "Failed to link");
        return;
      }
      toast.success(
        `Linked ${sessionIds.length} guest(s): ${payload.hosted_lobbies ?? 0} hosted, ${payload.player_slots ?? 0} player slots`
      );
      closeLink();
      load();
    } catch (e) {
      console.error("admin_link_guest_data failed:", e);
      toast.error(e instanceof Error ? e.message : "Failed to link");
    } finally {
      setBusy(false);
    }
  };

  const dialogUsers = useMemoFilteredUsers(users, dialogQuery);
  const dialogGuests = useMemoFilteredGuests(identities, dialogQuery);

  if (roleLoading || !isAdmin) {
    return (
      <div className="min-h-screen relative">
        <StarField />
        <div className="relative z-10 p-12 text-center font-display text-sm uppercase tracking-[0.15em] text-muted-foreground">
          Checking access…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="mb-6 font-display text-sm uppercase tracking-[0.15em] text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Home
          </Button>

          <h1 className="font-display text-3xl md:text-4xl font-black tracking-[0.15em] text-primary text-glow text-center mb-2 flex items-center justify-center gap-3">
            <Shield className="h-7 w-7" /> User Administration
          </h1>
          <div className="imperial-divider w-48 mx-auto mb-8" />
        </motion.div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-4 w-full max-w-3xl mx-auto mb-6 glass imperial-border">
            <TabsTrigger value="users" className="font-display text-xs uppercase tracking-[0.15em]">
              <UsersIcon className="mr-2 h-4 w-4" /> Users ({users.length})
            </TabsTrigger>
            <TabsTrigger value="guests" className="font-display text-xs uppercase tracking-[0.15em]">
              <Ghost className="mr-2 h-4 w-4" /> Guests ({identities.length})
            </TabsTrigger>
            <TabsTrigger value="rules" className="font-display text-xs uppercase tracking-[0.15em]">
              <BookOpen className="mr-2 h-4 w-4" /> Rules PDFs
            </TabsTrigger>
            <TabsTrigger value="factions" className="font-display text-xs uppercase tracking-[0.15em]">
              <Sparkles className="mr-2 h-4 w-4" /> Factions
            </TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, nickname, full name, or user ID…"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="pl-9 glass imperial-border"
              />
            </div>
            <div className="glass imperial-border rounded overflow-hidden">
              {loading ? (
                <p className="font-body text-sm text-muted-foreground text-center py-6">Loading…</p>
              ) : filteredUsers.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground text-center py-6">
                  {users.length === 0 ? "No registered users." : "No users match."}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-sm text-foreground truncate">
                          <span className="text-primary">{u.nickname ?? u.full_name ?? "(no profile)"}</span>{" "}
                          <span className="text-muted-foreground">· {u.email}</span>
                        </div>
                        <div className="font-body text-[10px] text-muted-foreground/70 truncate">
                          <code>{u.id}</code> · joined {new Date(u.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openUserLink(u)}
                        className="font-display text-xs uppercase tracking-[0.15em]"
                      >
                        <Link2 className="mr-1 h-3 w-3" /> Link Guests
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* GUESTS TAB */}
          <TabsContent value="guests">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by guest name or session ID…"
                value={guestQuery}
                onChange={(e) => setGuestQuery(e.target.value)}
                className="pl-9 glass imperial-border"
              />
            </div>
            <div className="glass imperial-border rounded p-4">
              {loading ? (
                <p className="font-body text-sm text-muted-foreground text-center py-4">Loading…</p>
              ) : filteredGuests.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground text-center py-4">
                  {identities.length === 0 ? "Nothing unclaimed." : "No guests match."}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredGuests.map((it) => (
                    <div
                      key={it.sessionId}
                      className="flex items-start justify-between gap-3 rounded border border-border bg-background/40 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-sm text-foreground truncate">
                          {it.names.length > 0 ? it.names.join(", ") : "(no name)"}
                        </div>
                        <div className="font-body text-xs text-muted-foreground">
                          {it.hostedLobbies > 0 && (
                            <>Host of {it.hostedLobbies} {it.hostedLobbies === 1 ? "lobby" : "lobbies"} · </>
                          )}
                          {it.playerSlots} player {it.playerSlots === 1 ? "slot" : "slots"}
                        </div>
                        <div className="font-body text-[10px] text-muted-foreground/70 mt-1 truncate">
                          <code>{it.sessionId}</code>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => openGuestLink(it)}
                        className="font-display text-xs uppercase tracking-[0.15em]"
                      >
                        <Link2 className="mr-1 h-3 w-3" /> Link to User
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* RULES PDFs TAB */}
          <TabsContent value="rules">
            <RulesSourcesPanel />
          </TabsContent>

          {/* FACTIONS TAB */}
          <TabsContent value="factions">
            <FactionDataPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Link dialog */}
      <Dialog open={!!linkMode} onOpenChange={(o) => !o && closeLink()}>
        <DialogContent className="glass imperial-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg uppercase tracking-[0.15em] text-primary">
              {linkMode?.kind === "guest-to-user"
                ? "Link guest identity to user"
                : "Link guest identities to user"}
            </DialogTitle>
            <DialogDescription className="font-body text-sm text-muted-foreground">
              {linkMode?.kind === "guest-to-user" && (
                <>
                  Assign <strong>{linkMode.guest.names.join(", ") || "(no name)"}</strong>{" "}
                  ({linkMode.guest.hostedLobbies} hosted, {linkMode.guest.playerSlots} player slots)
                  to a user account.
                </>
              )}
              {linkMode?.kind === "user-to-guests" && (
                <>
                  Pick one or more unclaimed guest identities to attach to{" "}
                  <strong>{userLabel(linkMode.user)}</strong> ({linkMode.user.email}).
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={linkMode?.kind === "guest-to-user" ? "Search users…" : "Search guests…"}
              value={dialogQuery}
              onChange={(e) => setDialogQuery(e.target.value)}
              className="pl-9 glass imperial-border"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1 py-1">
            {linkMode?.kind === "guest-to-user" &&
              dialogUsers.map((u) => {
                const picked = pickedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setPickedUserId(u.id)}
                    className={`w-full text-left rounded border p-2 transition ${
                      picked ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="font-body text-sm text-foreground truncate">{userLabel(u)}</div>
                    <div className="font-body text-xs text-muted-foreground truncate">{u.email}</div>
                  </button>
                );
              })}
            {linkMode?.kind === "user-to-guests" &&
              (dialogGuests.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground text-center py-4">
                  No unclaimed guests.
                </p>
              ) : (
                dialogGuests.map((g) => {
                  const picked = pickedGuestIds.includes(g.sessionId);
                  return (
                    <button
                      key={g.sessionId}
                      type="button"
                      onClick={() =>
                        setPickedGuestIds((prev) =>
                          prev.includes(g.sessionId)
                            ? prev.filter((id) => id !== g.sessionId)
                            : [...prev, g.sessionId]
                        )
                      }
                      className={`w-full text-left rounded border p-2 transition ${
                        picked ? "border-primary bg-primary/10" : "border-border bg-background/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="font-body text-sm text-foreground truncate">
                        {g.names.length > 0 ? g.names.join(", ") : "(no name)"}
                      </div>
                      <div className="font-body text-xs text-muted-foreground">
                        {g.hostedLobbies} hosted · {g.playerSlots} player slots
                      </div>
                      <div className="font-body text-[10px] text-muted-foreground/70 truncate">
                        <code>{g.sessionId}</code>
                      </div>
                    </button>
                  );
                })
              ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeLink}
              disabled={busy}
              className="font-display text-xs uppercase tracking-[0.15em]"
            >
              Cancel
            </Button>
            <Button
              onClick={performLink}
              disabled={
                busy ||
                (linkMode?.kind === "guest-to-user" && !pickedUserId) ||
                (linkMode?.kind === "user-to-guests" && pickedGuestIds.length === 0)
              }
              className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy
                ? "Linking…"
                : linkMode?.kind === "user-to-guests"
                ? `Link ${pickedGuestIds.length || ""}`.trim()
                : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// helpers (kept in-file for simplicity)
function useMemoFilteredUsers(users: AdminUser[], q: string) {
  return useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(s) ||
        u.nickname?.toLowerCase().includes(s) ||
        u.full_name?.toLowerCase().includes(s) ||
        u.id.toLowerCase().includes(s)
    );
  }, [users, q]);
}

function useMemoFilteredGuests(items: GuestIdentity[], q: string) {
  return useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (g) =>
        g.sessionId.toLowerCase().includes(s) ||
        g.names.some((n) => n.toLowerCase().includes(s))
    );
  }, [items, q]);
}

export default Admin;
