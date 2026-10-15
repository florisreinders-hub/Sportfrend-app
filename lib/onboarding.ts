import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "sportfrend.onboardingSeen.";

/**
 * Per gebruikers-ID (niet één vlag voor het hele toestel) - zodat een
 * tweede account dat op hetzelfde toestel inlogt de uitleg ook nog een
 * keer ziet. Geen databasekolom/migratie: dit is puur lokale UI-state op
 * dit toestel, niets dat tussen apparaten hoeft te synchroniseren.
 *
 * Faalt open (behandelt als "al gezien") als AsyncStorage niet te lezen
 * is - een eenmalig uitlegscherm mag de app nooit blokkeren of de
 * gebruiker vastzetten achter een storage-fout.
 */
export async function hasSeenOnboarding(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_PREFIX + userId)) === "1";
  } catch {
    return true;
  }
}

export async function markOnboardingSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + userId, "1");
  } catch {
    // Best-effort: in het ergste geval verschijnt de uitleg nog een keer.
  }
}
