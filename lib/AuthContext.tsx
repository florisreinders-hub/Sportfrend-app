import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { CustomerInfo } from "react-native-purchases";
import { isSupabaseConfigured, supabase } from "./supabase";
import { clearPushToken, registerForPushNotificationsAsync } from "./notifications";
import { addCustomerInfoListener, fetchCustomerInfo, getPlanFromCustomerInfo, identifyPurchaser, resetPurchaserIdentity } from "./purchases";

type AuthContextValue = {
  session: Session | null;
  initializing: boolean;
  /** Whether the signed-in user's profile already has a location saved. */
  hasLocation: boolean;
  /** True while the location check for the current session is in flight. */
  checkingLocation: boolean;
  /**
   * RevenueCat's CustomerInfo for the signed-in user (null while
   * unconfigured/not yet fetched/signed out). Kept here, centrally,
   * rather than each screen managing its own fetch + listener -
   * addCustomerInfoListener() (lib/purchases.ts) keeps this current the
   * instant a purchase/renewal/expiration happens, without polling.
   */
  customerInfo: CustomerInfo | null;
  /** Derived from customerInfo - "basis" | "premium" | "elite". See lib/purchases.ts's getPlanFromCustomerInfo(). */
  plan: "basis" | "premium" | "elite";
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  initializing: true,
  hasLocation: false,
  checkingLocation: false,
  customerInfo: null,
  plan: "basis",
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
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  // Tracks which user's location we've already checked, so a background
  // token refresh (onAuthStateChange fires for that too, not just a real
  // sign-in) doesn't re-trigger checkingLocation for the same user - that
  // would flip RootNavigator's loading gate back on and remount the
  // navigator mid-session, snapping the user back to its initial route.
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Registered once, for the app's whole lifetime, not re-registered per
    // sign-in/out - RevenueCat's own logIn()/logOut() (called below)
    // determines *which* customer this reflects; the listener itself just
    // needs to exist to catch a purchase/renewal/expiration/refund
    // whenever RevenueCat reports one, without polling getCustomerInfo()
    // on a timer.
    addCustomerInfoListener(setCustomerInfo);

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
          await identifyPurchaser(data.session.user.id);
          setCustomerInfo(await fetchCustomerInfo());
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
        // Capture who just signed out before clearing the ref: this
        // device's push token must be removed from *their* profile, not
        // left pointing here - otherwise a push meant for them (a new
        // match/message) would still arrive on whatever device/account
        // signs in here next. See clearPushToken()'s own comment.
        const signedOutUserId = checkedUserIdRef.current;
        checkedUserIdRef.current = null;
        setHasLocation(false);
        setCustomerInfo(null);
        resetPurchaserIdentity();
        if (signedOutUserId) {
          clearPushToken(signedOutUserId);
        }
        return;
      }

      if (userId === checkedUserIdRef.current) {
        // Same user we already checked (e.g. TOKEN_REFRESHED) - nothing to do.
        return;
      }

      // A *different* user's session replacing the previous one directly
      // (no intervening signed-out state) isn't a path this app's own UI
      // takes - signing out always fires its own null-session event
      // first - but guard it anyway: the previous user's token must not
      // be left behind here either.
      const previousUserId = checkedUserIdRef.current;
      if (previousUserId) {
        clearPushToken(previousUserId);
      }

      checkedUserIdRef.current = userId;
      setCheckingLocation(true);
      fetchHasLocation(userId).then((result) => {
        setHasLocation(result);
        setCheckingLocation(false);
      });
      registerForPushNotificationsAsync(userId);
      identifyPurchaser(userId).then(async () => {
        setCustomerInfo(await fetchCustomerInfo());
      });
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        initializing,
        hasLocation,
        checkingLocation,
        customerInfo,
        plan: getPlanFromCustomerInfo(customerInfo),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
