import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";

type AuthContextValue = {
  session: Session | null;
  initializing: boolean;
  /** Whether the signed-in user's profile already has a location saved. */
  hasLocation: boolean;
  /** True while the location check for the current session is in flight. */
  checkingLocation: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  initializing: true,
  hasLocation: false,
  checkingLocation: false,
});

async function fetchHasLocation(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("latitude, longitude, city")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("Kon locatiestatus niet ophalen:", error);
    return false;
  }
  return Boolean(data && (data.latitude != null || data.longitude != null || data.city));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasLocation, setHasLocation] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // No valid Supabase project configured: don't hang on a network call that
      // will only ever fail, just fall through to the signed-out state.
      setInitializing(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        if (data.session?.user) {
          setCheckingLocation(true);
          setHasLocation(await fetchHasLocation(data.session.user.id));
          setCheckingLocation(false);
        }
      })
      .catch((error) => {
        console.warn("Kon Supabase sessie niet ophalen:", error);
      })
      .finally(() => {
        setInitializing(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setCheckingLocation(true);
        fetchHasLocation(newSession.user.id).then((result) => {
          setHasLocation(result);
          setCheckingLocation(false);
        });
      } else {
        setHasLocation(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, initializing, hasLocation, checkingLocation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
