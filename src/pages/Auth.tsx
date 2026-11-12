import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNativePlatform } from "@/lib/platform";
import { signInWithProviderNative } from "@/lib/nativeAuth";
import { isInAppBrowser, getMobileOS, openInBrowserHref } from "@/lib/inAppBrowser";
import { ExternalLink, Copy } from "lucide-react";
import tiEmblem from "@/assets/ti-emblem.png";

const emailSchema = z.string().trim().email({ message: "Invalid email address" }).max(255);
const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(72);
const POST_AUTH_PATH_KEY = "ti4_post_auth_path";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const stateFrom = (location.state as { from?: string } | null)?.from;
  const from = stateFrom?.startsWith("/") && !stateFrom.startsWith("//") ? stateFrom : "/";

  const native = isNativePlatform();

  useEffect(() => {
    if (!loading && user) {
      const savedPath = localStorage.getItem(POST_AUTH_PATH_KEY);
      localStorage.removeItem(POST_AUTH_PATH_KEY);
      navigate(savedPath?.startsWith("/") && !savedPath.startsWith("//") ? savedPath : from, { replace: true });
    }
  }, [loading, user, from, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailParse = emailSchema.safeParse(email);
    if (!emailParse.success) {
      toast.error(emailParse.error.errors[0].message);
      return;
    }
    const passParse = passwordSchema.safeParse(password);
    if (!passParse.success) {
      toast.error(passParse.error.errors[0].message);
      return;
    }
    setBusy(true);
    if (tab === "signup") {
      const { error } = await supabase.auth.signUp({
        email: emailParse.data,
        password: passParse.data,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailParse.data,
        password: passParse.data,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
  };

  // Chat/social apps' built-in browsers: send people to the real browser,
  // keeping the page they were heading to (e.g. a lobby invite link).
  const inApp = isInAppBrowser();
  const os = getMobileOS();
  const targetUrl = `${window.location.origin}${from}`;
  const openHref = inApp ? openInBrowserHref(targetUrl, os) : null;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      toast.success("Link copied — paste it into your browser");
    } catch {
      toast.error(targetUrl);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const intendedPath = from.startsWith("/") && !from.startsWith("//") ? from : "/";
    localStorage.setItem(POST_AUTH_PATH_KEY, intendedPath);
    // Redirects the browser to Google; the session is completed on /auth/callback
    // (supabase-js exchanges the PKCE ?code= automatically on page load).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setBusy(false);
    }
  };

  // Native OAuth: open the provider in the system browser; the session completes
  // via the appUrlOpen deep-link handler in App.tsx (see src/lib/nativeAuth.ts).
  const handleNativeOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    const { error } = await signInWithProviderNative(provider);
    if (error) {
      toast.error(`${provider === "apple" ? "Apple" : "Google"} sign-in failed`);
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 max-w-md mx-auto px-4 py-12">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <img src={tiEmblem} alt="Twilight Imperium Emblem" className="w-20 h-20 mx-auto mb-4 drop-shadow-[0_0_15px_hsl(42_85%_55%/0.3)]" />
          <div className="imperial-divider w-48 mx-auto mb-4" />
          <h1 className="font-display text-2xl md:text-3xl font-black tracking-[0.15em] text-primary text-glow mb-2">
            Sign In
          </h1>
          <p className="font-display text-xs uppercase tracking-[0.4em] text-muted-foreground">
            To Begin Your Reign
          </p>
          <div className="imperial-divider w-48 mx-auto mt-4" />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass imperial-border rounded p-6 space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin" className="font-display text-xs uppercase tracking-[0.15em]">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="font-display text-xs uppercase tracking-[0.15em]">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
            />
            <Input
              type="password"
              placeholder="Password (8+ chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              className="bg-input border-border font-body text-foreground focus:border-primary/40 rounded"
            />
            <Button
              type="submit"
              disabled={busy}
              className="w-full font-display text-sm uppercase tracking-[0.2em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {busy ? "..." : tab === "signup" ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 font-body text-xs uppercase tracking-wider text-muted-foreground">or</span>
            </div>
          </div>

          {native ? (
            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => handleNativeOAuth("google")}
                disabled={busy}
                variant="outline"
                className="w-full font-display text-sm uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                Continue with Google
              </Button>
              <Button
                type="button"
                onClick={() => handleNativeOAuth("apple")}
                disabled={busy}
                variant="outline"
                className="w-full font-display text-sm uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                Sign in with Apple
              </Button>
            </div>
          ) : inApp ? (
            // Google blocks sign-in inside chat apps' built-in browsers (400 "malformed" error).
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 space-y-3 text-center">
              <p className="font-body text-sm text-amber-300">
                Google sign-in doesn't work inside this app's built-in browser.
                Open the page in {os === "ios" ? "Safari" : "your browser"} to continue with Google.
              </p>
              {openHref && (
                <Button
                  asChild
                  className="w-full font-display text-sm uppercase tracking-[0.15em] glow-primary bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <a href={openHref}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in {os === "ios" ? "Safari" : "Browser"}
                  </a>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={copyLink}
                className="w-full font-display text-xs uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
              >
                <Copy className="mr-2 h-3 w-3" />
                Copy link
              </Button>
              <p className="font-body text-xs text-muted-foreground">
                Or tap the <span className="text-foreground">⋯</span> menu and choose
                {" "}“Open in {os === "ios" ? "Safari" : "browser"}”. Email sign-in above works here too.
              </p>
            </div>
          ) : (
            <Button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              variant="outline"
              className="w-full font-display text-sm uppercase tracking-[0.15em] border-border text-muted-foreground hover:text-primary hover:border-primary/40"
            >
              Continue with Google
            </Button>
          )}
        </motion.div>

        <div className="flex justify-center mt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="font-display text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-primary">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
