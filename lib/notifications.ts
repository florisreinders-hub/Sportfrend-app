import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import { getDataErrorMessage } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Writes (or clears, via `token: null`) this device's Expo push token
 * onto a profile - a plain UPDATE, never an upsert.
 *
 * Why not upsert: `authenticated` has no SELECT privilege on
 * `expo_push_token` at all (`0013_rls_security_audit_fixes.sql`, with
 * opzet - so another user's device token, which Expo's push API accepts
 * with no further authentication, can never leak via a profile read).
 * PostgREST's `.upsert()` generates `INSERT ... ON CONFLICT DO UPDATE
 * SET expo_push_token = EXCLUDED.expo_push_token`, and Postgres requires
 * SELECT privilege on any column referenced via `EXCLUDED.<column>` -
 * not just UPDATE privilege on it. That always failed with "permission
 * denied for table profiles", exactly like `LocationSetupScreen.tsx`'s
 * `saveLocation()` did for `latitude`/`longitude` before its own fix. A
 * plain UPDATE never references `EXCLUDED`, so it isn't subject to that
 * check, and doesn't need SELECT on `expo_push_token` either - which
 * must stay revoked.
 */
async function saveExpoPushToken(userId: string, token: string | null): Promise<void> {
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ expo_push_token: token })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;

  if (updated?.id) return;

  // UPDATE matched zero rows - the profile row doesn't exist yet for some
  // reason (handle_new_user()'s trigger didn't fire, an account that
  // predates it, etc.). Create a bare row, then retry the update - still
  // never an upsert, so still no EXCLUDED-on-expo_push_token privilege
  // problem. Same fallback as LocationSetupScreen.tsx's saveLocation().
  const { error: insertError } = await supabase.from("profiles").insert({ id: userId }).select("id").single();
  if (insertError) throw insertError;

  const { data: retried, error: retryError } = await supabase
    .from("profiles")
    .update({ expo_push_token: token })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (retryError) throw retryError;

  if (!retried?.id) {
    throw new Error("Push-token opslaan is niet gelukt: de database bevestigt geen opgeslagen token.");
  }
}

/**
 * Requests notification permission and saves this device's Expo push
 * token onto the signed-in user's profile (profiles.expo_push_token),
 * which the send-message-push/send-match-push Edge Functions read to
 * know where to deliver a notification.
 *
 * Expo Go (SDK 53+) no longer supports remote push registration on
 * either platform - Expo removed it because Expo Go is one shared app
 * that can't hold a distinct push credential per developer project. This
 * no-ops there (logs and returns) instead of throwing, so the rest of
 * the app keeps working when tested through Expo Go like every other
 * screen in this project has been. Getting a real, deliverable token
 * needs a custom development build (`eas build --profile development`)
 * instead - see README.md's "Pushmeldingen" section.
 *
 * Fire-and-forget by design (see AuthContext.tsx's callers, none of
 * which await this): a denied permission or a failed save is never fatal
 * to anything else, so this never throws out of this function and never
 * shows the user anything - only a console.warn.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    console.log("[Notifications] Expo Go biedt geen remote push meer aan - overslaan (zie README.md).");
    return;
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      console.log("[Notifications] Gebruiker heeft geen toestemming gegeven.");
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

    try {
      await saveExpoPushToken(userId, token);
      console.log("[Notifications] Push-token geregistreerd voor", userId);
    } catch (error) {
      console.warn("[Notifications] Kon push-token niet opslaan:", getDataErrorMessage(error));
    }
  } catch (error) {
    console.warn("[Notifications] Registratie mislukt:", error);
  }
}

/**
 * Clears this device's push token from a user's profile - call this on
 * sign-out and whenever a *different* user signs in on the same device
 * (see AuthContext.tsx), before that new user's own
 * registerForPushNotificationsAsync() call would otherwise be the only
 * thing to (eventually) overwrite it. Without this, the signed-out
 * user's profile keeps pointing at this device's token, and Expo's push
 * API would still deliver a notification meant for them (a new match, a
 * message) to whoever is now using this device.
 *
 * Fire-and-forget, same reasoning as registerForPushNotificationsAsync:
 * never blocks sign-out, never surfaces anything to the user. A plain
 * UPDATE (never an upsert, for the same EXCLUDED/SELECT-privilege reason
 * as saveExpoPushToken above) - no insert-if-missing fallback needed
 * here, since "the row doesn't exist" and "there's nothing to clear" are
 * the same outcome.
 */
export async function clearPushToken(userId: string): Promise<void> {
  try {
    const { error } = await supabase.from("profiles").update({ expo_push_token: null }).eq("id", userId);
    if (error) {
      console.warn("[Notifications] Kon push-token niet wissen:", getDataErrorMessage(error));
    }
  } catch (error) {
    console.warn("[Notifications] Wissen van push-token mislukt:", getDataErrorMessage(error));
  }
}
