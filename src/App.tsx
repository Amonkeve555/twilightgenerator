import { Suspense, useEffect } from "react";
import { lazyWithReload as lazy } from "@/lib/lazyWithReload";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import StarField from "@/components/StarField";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { isNativePlatform } from "@/lib/platform";
import { handleAuthDeepLink } from "@/lib/nativeAuth";
import Index from "./pages/Index.tsx";
const History = lazy(() => import("./pages/History.tsx"));
const CreateLobby = lazy(() => import("./pages/CreateLobby.tsx"));
const JoinLobby = lazy(() => import("./pages/JoinLobby.tsx"));
const LobbyView = lazy(() => import("./pages/LobbyView.tsx"));
const GameDay = lazy(() => import("./pages/GameDay.tsx"));
const GameBoard = lazy(() => import("./pages/GameBoard.tsx"));
const MyLobbies = lazy(() => import("./pages/MyLobbies.tsx"));
const FactionGuide = lazy(() => import("./pages/FactionGuide.tsx"));
const RulesAssistant = lazy(() => import("./pages/RulesAssistant.tsx"));
const MapSetup = lazy(() => import("./pages/MapSetup.tsx"));
const MapEditor = lazy(() => import("./pages/MapEditor.tsx"));
const Stats = lazy(() => import("./pages/Stats.tsx"));
import Auth from "./pages/Auth.tsx";
const AuthCallback = lazy(() => import("./pages/AuthCallback.tsx"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
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


/** Shown while a lazily-loaded page's code downloads. */
function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-display text-primary text-glow">Loading...</p>
    </div>
  );
}

/** Route switch with a soft fade/rise into each page (star field stays put behind). */
function AnimatedRoutes() {
  const location = useLocation();
  const reduce = useReducedMotion();
  return (
    // Enter-only fade. No AnimatePresence exit: with mode="wait", an instant
    // redirect (e.g. invite link -> /auth when signed out) left the old, empty
    // page "exiting" forever and the new page never mounted -> blank screen.
    <motion.div
        key={location.pathname}
        // opacity/translate only: a lingering filter/transform would break position:fixed children
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageLoading />}>
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
        </Suspense>
      </motion.div>
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
