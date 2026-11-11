import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import StarField from "./StarField";

interface AuthGuardProps {
  children: ReactNode;
  /** If true, also requires the user to have completed their profile (nickname). */
  requireProfile?: boolean;
}

const AuthGuard = ({ children, requireProfile = true }: AuthGuardProps) => {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();

  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen relative">
        <StarField />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <p className="font-display text-primary text-glow">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location.pathname + location.search }} replace />;
  }

  if (requireProfile && (!profile || !profile.nickname)) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
