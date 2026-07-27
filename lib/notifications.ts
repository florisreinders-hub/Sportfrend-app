import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

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

    // upsert: same silent-no-op reasoning as LocationSetupScreen/
    // EditProfileScreen - a profile row might not exist yet.
    const { error } = await supabase.from("profiles").upsert({ id: userId, expo_push_token: token }, { onConflict: "id" });
    if (error) {
      console.warn("[Notifications] Kon push-token niet opslaan:", error);
    } else {
      console.log("[Notifications] Push-token geregistreerd voor", userId);
    }
  } catch (error) {
    console.warn("[Notifications] Registratie mislukt:", error);
  }
}
