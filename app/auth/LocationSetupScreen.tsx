import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { getDataErrorMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "LocationSetup">;

// "idle": GPS is the primary path. "manual": permission was denied (or the
// user opted out of GPS), so the fallback text input is shown. "saved":
// location successfully stored, either way.
type Step = "idle" | "manual" | "saved";

export default function LocationSetupScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>("idle");
  // Only true when a real GPS permission denial put us on the "manual"
  // step - NOT when the user chose "Liever handmatig invullen" themselves,
  // and NOT just because a save attempt failed while already on this step
  // (see the "manual" branch below, which used to show the "permission
  // denied" banner unconditionally in both of those other cases too).
  const [deniedPermission, setDeniedPermission] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [manualCity, setManualCity] = useState("");

  const saveLocation = async (fields: { city: string | null; latitude: number | null; longitude: number | null }) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Je bent niet ingelogd.");
    }
    const userId = userData.user.id;

    // Plain UPDATE, not upsert: Postgres requires SELECT privilege on any
    // column referenced via an upsert's implicit `EXCLUDED.<column>` (not
    // just UPDATE privilege on it) - and `authenticated` has no SELECT on
    // latitude/longitude at all, by design
    // (supabase/migrations/0014_discover_profiles_location_privacy.sql).
    // `.upsert({ id, city, latitude, longitude }, ...)` therefore always
    // failed with "permission denied for table profiles", for both the
    // GPS and the manual route, regardless of what the actual values
    // were (even latitude: null, longitude: null still reference those
    // columns in the generated SQL). A plain UPDATE never references
    // EXCLUDED, so it isn't subject to that check - confirmed locally
    // against a schema matching production.
    //
    // Only selects id/city back, not latitude/longitude - same reasoning
    // as above: even reading back your own just-written coordinates
    // needs get_my_location() instead of a plain column read (see
    // PROFILE_COLUMNS's comment in lib/api.ts).
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", userId)
      .select("id, city")
      .maybeSingle();
    if (updateError) throw updateError;

    if (updated?.id) return;

    // UPDATE matched zero rows - the profile row doesn't exist yet for
    // some reason (handle_new_user()'s trigger didn't fire, an account
    // that predates it, etc.). Create a bare row, then retry the update -
    // still never an upsert, so still no EXCLUDED-on-latitude/longitude
    // privilege problem.
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId }).select("id").single();
    if (insertError) throw insertError;

    const { data: retried, error: retryError } = await supabase
      .from("profiles")
      .update(fields)
      .eq("id", userId)
      .select("id, city")
      .maybeSingle();
    if (retryError) throw retryError;

    if (!retried?.id) {
      throw new Error("Locatie opslaan is niet gelukt: de database bevestigt geen opgeslagen locatie.");
    }
  };

  const useCurrentLocation = async () => {
    setError(null);
    setRequesting(true);
    try {
      const { status: permission } = await Location.requestForegroundPermissionsAsync();
      if (permission !== "granted") {
        setDeniedPermission(true);
        setStep("manual");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      let city: string | null = null;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        city = place?.city ?? place?.subregion ?? place?.region ?? null;
      } catch {
        // Reverse geocoding can fail (offline, unsupported region, etc.) - the
        // coordinates are still useful on their own, so don't block on this.
      }

      setRequesting(false);
      setSaving(true);
      await saveLocation({ city, latitude, longitude });
      setResolvedCity(city);
      setStep("saved");
    } catch (e) {
      // Reached when permission WAS granted but something else failed
      // (GPS/location services, or saveLocation() itself) - not a
      // permission denial, so don't show that banner for this.
      setDeniedPermission(false);
      setError(getDataErrorMessage(e));
      setStep("manual");
    } finally {
      setRequesting(false);
      setSaving(false);
    }
  };

  const saveManualCity = async () => {
    const city = manualCity.trim();
    if (!city) return;
    setError(null);
    setSaving(true);
    try {
      // Best-effort: try to resolve the typed place name to coordinates so
      // distance-based matching still works, but the city name alone is
      // still saved even if geocoding finds nothing or fails.
      let latitude: number | null = null;
      let longitude: number | null = null;
      try {
        const [result] = await Location.geocodeAsync(city);
        if (result) {
          latitude = result.latitude;
          longitude = result.longitude;
        }
      } catch {
        // ignore - city name is still saved below
      }

      await saveLocation({ city, latitude, longitude });
      setResolvedCity(city);
      setStep("saved");
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const continueToApp = () => {
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Ionicons name="location" size={64} color={colors.primary} />
        <Text style={styles.title}>Bepaal je zoekgebied</Text>
        <Text style={styles.description}>
          In welke regio wil je mensen ontmoeten? Jouw exacte adres wordt niet gedeeld met andere gebruikers.
        </Text>

        {step === "saved" ? (
          <>
            <Text style={styles.status}>
              {resolvedCity
                ? `Locatie ingesteld op ${resolvedCity}. We laten je nu sporters in de buurt zien.`
                : "Locatie ingesteld. We laten je nu sporters in de buurt zien."}
            </Text>
            <Button label="Doorgaan" onPress={continueToApp} style={styles.cta} />
          </>
        ) : step === "manual" ? (
          <>
            {deniedPermission ? (
              <Text style={styles.statusError}>
                Locatietoegang geweigerd. Geen probleem — vul je plaats hieronder handmatig in.
              </Text>
            ) : !error ? (
              <Text style={styles.status}>Vul je plaats hieronder handmatig in.</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Input
              placeholder="Bijv. Amsterdam"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              value={manualCity}
              onChangeText={(text) => {
                setManualCity(text);
                if (error) setError(null);
              }}
              onSubmitEditing={saveManualCity}
              style={styles.input}
            />
            <Button
              label="Locatie opslaan"
              onPress={saveManualCity}
              loading={saving}
              disabled={!manualCity.trim()}
              style={styles.cta}
            />
            <Text style={styles.link} onPress={useCurrentLocation}>
              Toch mijn locatie gebruiken
            </Text>
          </>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Kies dit zoekgebied"
              onPress={useCurrentLocation}
              loading={requesting || saving}
              style={styles.cta}
            />
            <Text
              style={styles.link}
              onPress={() => {
                setError(null);
                setStep("manual");
              }}
            >
              Liever handmatig invullen
            </Text>
          </>
        )}

        {step !== "saved" ? (
          <Text style={styles.skip} onPress={continueToApp}>
            Overslaan
          </Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.md,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  statusError: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  input: {
    width: "100%",
    marginTop: spacing.lg,
    marginBottom: 0,
  },
  cta: {
    marginTop: spacing.lg,
    width: "100%",
    borderRadius: radii.md,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
    marginTop: spacing.md,
  },
  skip: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
