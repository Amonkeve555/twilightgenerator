import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import StarField from "@/components/StarField";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { isNativePlatform } from "@/lib/platform";
import { handleAuthDeepLink } from "@/lib/nativeAuth";
import Index from "./pages/Index.tsx";
import History from "./pages/History.tsx";
import CreateLobby from "./pages/CreateLobby.tsx";
import JoinLobby from "./pages/JoinLobby.tsx";
import LobbyView from "./pages/LobbyView.tsx";
import GameDay from "./pages/GameDay.tsx";
import GameBoard from "./pages/GameBoard.tsx";
import MyLobbies from "./pages/MyLobbies.tsx";
import FactionGuide from "./pages/FactionGuide.tsx";
import RulesAssistant from "./pages/RulesAssistant.tsx";
import MapSetup from "./pages/MapSetup.tsx";
import MapEditor from "./pages/MapEditor.tsx";
import Stats from "./pages/Stats.tsx";
import Auth from "./pages/Auth.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import ProfileSetup from "./pages/ProfileSetup.tsx";
import Admin from "./pages/Admin.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

/** On native, listen for the OAuth deep-link callback and complete sign-in. */
function useNativeAuthDeepLink() {
  useEffect(() => {
    if (!isNativePlatform()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      const handle = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        try {
          await handleAuthDeepLink(url);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Sign-in failed");
        }
      });
      remove = () => handle.remove();
    })();
    return () => remove?.();
  }, []);
}


/** Route switch with a soft fade/rise between pages (star field stays put behind). */
function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        // opacity/translate only: a lingering filter/transform would break position:fixed children
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile-setup" element={<AuthGuard requireProfile={false}><ProfileSetup /></AuthGuard>} />
          <Route path="/factions" element={<FactionGuide />} />
          <Route path="/rules" element={<AuthGuard><RulesAssistant /></AuthGuard>} />
          <Route path="/map-setup" element={<MapSetup />} />
          <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />
          <Route path="/stats" element={<AuthGuard><Stats /></AuthGuard>} />
          <Route path="/create" element={<AuthGuard><CreateLobby /></AuthGuard>} />
          <Route path="/join/:inviteCode" element={<AuthGuard><JoinLobby /></AuthGuard>} />
          <Route path="/lobby/:inviteCode" element={<AuthGuard><LobbyView /></AuthGuard>} />
          <Route path="/lobby/:inviteCode/map-editor" element={<AuthGuard><MapEditor /></AuthGuard>} />
          <Route path="/lobby/:inviteCode/gameday" element={<AuthGuard><GameDay /></AuthGuard>} />
          <Route path="/game/:code" element={<AuthGuard><GameBoard /></AuthGuard>} />
          <Route path="/my-lobbies" element={<AuthGuard><MyLobbies /></AuthGuard>} />
          <Route path="/users" element={<AuthGuard><Admin /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><Admin /></AuthGuard>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

const App = () => {
  useNativeAuthDeepLink();
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <StarField />
        <AnimatedRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
