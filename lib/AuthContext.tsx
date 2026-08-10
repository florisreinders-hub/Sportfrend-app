import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabase";
import { registerForPushNotificationsAsync } from "./notifications";

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

// Reads via get_my_location() (see PROFILE_COLUMNS's comment in lib/api.ts)
// instead of a plain `profiles` select - the `authenticated` role's
// column-level SELECT on latitude/longitude is revoked entirely
// (supabase/migrations/0014_discover_profiles_location_privacy.sql), so
// even reading back your own coordinates needs this SECURITY DEFINER
// function scoped to auth.uid()'s own row. `userId` is only used for the
// log line below - the function itself always resolves to the calling
// session's own user regardless of what's passed here.
async function fetchHasLocation(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("get_my_location");
  if (error) {
    console.warn("[AuthContext] Kon locatiestatus niet ophalen:", error);
    return false;
  }
  const row = Array.isArray(data) ? data[0] : data;
  const hasLocation = Boolean(row && (row.latitude != null || row.longitude != null || row.city));
  console.log("[AuthContext] Locatiestatus voor", userId, "->", row, "hasLocation:", hasLocation);
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
          // Fire-and-forget: a permission prompt shouldn't hold up the
          // app's own loading state, and a denial/failure here isn't
          // fatal to anything else.
          registerForPushNotificationsAsync(data.session.user.id);
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
      registerForPushNotificationsAsync(userId);
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
