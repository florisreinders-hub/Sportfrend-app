import { Alert, Linking } from "react-native";

/** The only two places these URLs are hardcoded - RegisterDetailsScreen's consent checkbox, SettingsScreen's "Juridisch" section and PricingScreen all import from here instead of repeating the literal URL. */
export const TERMS_URL = "https://www.sportfrend.nl/#voorwaarden";
export const PRIVACY_URL = "https://www.sportfrend.nl/#privacy";

/** Opens a legal document link in the device's own browser (not an in-app WebView) - same Linking.openURL() + failure Alert pattern used for every other outbound link in this app. */
export function openLegalUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Kon niet openen", "Deze link kon niet geopend worden. Controleer je internetverbinding.");
  });
}
