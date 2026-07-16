import React, { createContext, useContext, useEffect, useRef, useState } from "react";
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
    console.warn("[AuthContext] Kon locatiestatus niet ophalen:", error);
    return false;
  }
  const hasLocation = Boolean(data && (data.latitude != null || data.longitude != null || data.city));
  console.log("[AuthContext] Locatiestatus voor", userId, "->", data, "hasLocation:", hasLocation);
  return hasLocation;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [hasLocation, setHasLocation] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);

  // Tracks which user's location we've already checked, so a background
  // token refresh (onAuthStateChange fires for that too, not just a real
  // sign-in) doesn't re-trigger checkingLocation for the same user - that
  // would flip RootNavigator's loading gate back on and remount the
  // navigator mid-session, snapping the user back to its initial route.
  const checkedUserIdRef = useRef<string | null>(null);

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
          checkedUserIdRef.current = data.session.user.id;
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

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      const userId = newSession?.user?.id ?? null;

      if (!userId) {
        checkedUserIdRef.current = null;
        setHasLocation(false);
        return;
      }

      if (userId === checkedUserIdRef.current) {
        // Same user we already checked (e.g. TOKEN_REFRESHED) - nothing to do.
        return;
      }

      checkedUserIdRef.current = userId;
      setCheckingLocation(true);
      fetchHasLocation(userId).then((result) => {
        setHasLocation(result);
        setCheckingLocation(false);
      });
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
