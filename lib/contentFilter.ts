import { Alert } from "react-native";
import { supabase } from "./supabase";

/**
 * "Waarschuwen, niet blokkeren" (see 0027_content_filter.sql's full
 * writeup of the trade-off): calls find_flagged_words() purely so the
 * client can show a friendly warning *before* submitting - the actual,
 * unavoidable enforcement is the AFTER INSERT/UPDATE trigger on
 * profiles/messages/posts/trainings, which runs regardless of whether
 * this check ever happens (a modified client skipping this call still
 * gets flagged server-side, it just doesn't see the warning first).
 *
 * Fails open like every other optional-status RPC in this app
 * (fetchDiscoverDailyStatus, fetchMessagesDailyStatus, ...): a failure
 * here (RPC not deployed yet, network hiccup) is logged, not thrown -
 * the caller proceeds as if nothing matched rather than blocking a
 * legitimate send/save because the *warning* mechanism itself failed.
 */
export async function checkContentFilter(text: string): Promise<string[]> {
  if (!text || !text.trim()) return [];
  try {
    const { data, error } = await supabase.rpc("find_flagged_words", { p_text: text });
    if (error) throw error;
    return (data as string[] | null) ?? [];
  } catch (e) {
    console.warn("[contentFilter] Kon find_flagged_words() niet aanroepen:", e);
    return [];
  }
}

/**
 * Shows the "mogelijk ongepaste taal"-confirmation and resolves to
 * whether the caller chose to proceed anyway. `what`/`verb` fill in the
 * two content-specific words ("bericht"/"versturen", "bio"/"opslaan",
 * ...) so the same dialog reads naturally across all four call sites.
 */
export function confirmFlaggedContent(what: string, verb: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      "Mogelijk ongepaste taal",
      `Dit ${what} bevat mogelijk ongepaste taal. Pas het aan, of ${verb} het toch - dat wordt dan gemarkeerd voor beoordeling.`,
      [
        { text: "Aanpassen", style: "cancel", onPress: () => resolve(false) },
        { text: `Toch ${verb}`, style: "destructive", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
