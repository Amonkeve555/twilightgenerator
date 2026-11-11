import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StarField from "@/components/StarField";

const POST_AUTH_PATH_KEY = "ti4_post_auth_path";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    let active = true;

    const finish = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;

      if (error || !data.user) {
        setMessage("Sign in could not be completed. Please try again.");
        window.setTimeout(() => navigate("/auth", { replace: true }), 1500);
        return;
      }

      const savedPath = localStorage.getItem(POST_AUTH_PATH_KEY);
      localStorage.removeItem(POST_AUTH_PATH_KEY);
      const destination = savedPath?.startsWith("/") && !savedPath.startsWith("//")
        ? savedPath
        : "/";
      navigate(destination, { replace: true });
    };

    finish();
    return () => { active = false; };
  }, [navigate]);

  return (
    <div className="min-h-screen relative">
      <StarField />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <p className="font-display text-primary text-glow">{message}</p>
      </div>
    </div>
  );
};

export default AuthCallback;