import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, User as UserIcon, Download, Shield } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import ClaimGuestDataDialog, { type ClaimGuestDataHandle } from "@/components/ClaimGuestDataDialog";

const UserMenu = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();
  const claimRef = useRef<ClaimGuestDataHandle>(null);

  if (!user) {
    return (
      <Button
        size="sm"
        onClick={() => navigate("/auth")}
        className="font-display text-xs uppercase tracking-[0.15em] bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Sign In
      </Button>
    );
  }

  const initials = (profile?.nickname || profile?.full_name || user.email || "?")
    .split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <>
      <ClaimGuestDataDialog ref={claimRef} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="font-display text-xs uppercase tracking-[0.15em] border-primary/40 text-primary hover:bg-primary/10">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px]">{initials}</span>
            {profile?.nickname ?? "Profile"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="glass imperial-border">
          <DropdownMenuLabel className="font-body text-xs text-muted-foreground">
            {profile?.full_name ?? user.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/profile-setup")} className="font-body cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" /> Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => claimRef.current?.openManually()} className="font-body cursor-pointer">
            <Download className="mr-2 h-4 w-4" /> Claim Guest Data
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => navigate("/users")} className="font-body cursor-pointer">
              <Shield className="mr-2 h-4 w-4" /> User Administration
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={signOut} className="font-body cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default UserMenu;
