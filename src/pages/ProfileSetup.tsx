import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StarField from "@/components/StarField";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import ClaimGuestDataDialog from "@/components/ClaimGuestDataDialog";

const fullNameSchema = z.string().trim().min(1, "Full name required").max(80);
const nicknameSchema = z
  .string()
  .trim()
  .min(2, "Nickname must be at least 2 characters")
  .max(80, "Nickname must be 80 characters or less");

const ProfileSetup = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setNickname(profile.nickname ?? "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const fnP = fullNameSchema.safeParse(fullName);
    if (!fnP.success) { toast.error(fnP.error.errors[0].message); return; }
    const nP = nicknameSchema.safeParse(nickname);
    if (!nP.success) { toast.error(nP.error.errors[0].message); return; }

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: fnP.data, nickname: nP.data }, { onConflict: "id" });
    setBusy(false);
    if (error) {
      if (error.code === "23505") toast.error("That nickname is already taken");
      else toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    await refetch();
    navigate("/", { replace: true });
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen relative">
        <StarField />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <p className="font-display text-primary text-glow">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StarField />
      <ClaimGuestDataDialog />
      <div className="relative z-10 max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="imperial-divider w-48 mx-auto mb-4" />
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Your Profile
          </h1>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Choose Your Banner
          </p>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <motion.form onSubmit={save} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass imperial-border rounded p-6 space-y-4">
          <div className="space-y-2">
            <label className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Full Name</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your real name"
              className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
            />
          </div>
          <div className="space-y-2">
            <label className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground">Nickname (shown in games)</label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Galactic_Sven"
              className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
            />
            <p className="font-body text-xs text-muted-foreground">
              This is what other players will see. Must be unique.
            </p>
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="w-full font-display text-sm uppercase tracking-[0.2em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? "Saving..." : "Save & Continue"}
          </Button>
        </motion.form>
      </div>
    </div>
  );
};

export default ProfileSetup;
