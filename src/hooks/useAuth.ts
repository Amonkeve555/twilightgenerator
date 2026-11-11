import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthSnapshot = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let snapshot: AuthSnapshot = { session: null, user: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

const emit = () => listeners.forEach((listener) => listener());

const initializeAuth = () => {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    snapshot = { session, user: session?.user ?? null, loading: false };
    emit();
  });

  supabase.auth.getSession().then(({ data, error }) => {
    snapshot = {
      session: error ? null : data.session,
      user: error ? null : data.session?.user ?? null,
      loading: false,
    };
    emit();
  });
};

initializeAuth();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useAuth() {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
