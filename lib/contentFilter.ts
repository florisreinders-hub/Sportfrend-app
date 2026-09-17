import { Alert } from "react-native";
import { supabase } from "./supabase";

/**
 * Hard block (see 0028_content_filter_hard_block.sql's full writeup):
 * calls find_flagged_words() so the client can reject a match immediately,
 * before ever reaching the server. The actual, unavoidable enforcement is
 * the BEFORE INSERT/UPDATE trigger on profiles/messages/posts/trainings,
 * which runs regardless of whether this check ever happens - a modified
 * client skipping this call still gets its write rejected server-side
 * (the trigger returns NULL, cancelling the row), it just doesn't get the
 * friendly message first and instead sees a generic save/send failure.
 *
 * Fails open like every other optional-status RPC in this app
 * (fetchDiscoverDailyStatus, fetchMessagesDailyStatus, ...): a failure
 * here (RPC not deployed yet, network hiccup) is logged, not thrown - the
 * caller proceeds as if nothing matched. The server-side trigger is the
 * real backstop if that guess turns out to be wrong.
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
 * Shows the "kan niet worden verstuurd/opgeslagen"-blocking alert - a
 * single "OK" button, no way to proceed anyway. `what`/`participle` fill
 * in the two content-specific words ("bericht"/"verstuurd",
 * "bio"/"opgeslagen", ...) so the same alert reads naturally across all
 * call sites.
 */
export function showContentFilterBlockedAlert(what: string, participle: string): void {
  Alert.alert(
    "Ongepaste taal",
    `Dit ${what} bevat ongepaste taal en kan niet worden ${participle}. Pas het aan en probeer opnieuw.`,
    [{ text: "OK" }]
  );
}
