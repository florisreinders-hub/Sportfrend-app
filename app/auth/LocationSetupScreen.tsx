import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "LocationSetup">;

export default function LocationSetupScreen({ navigation }: Props) {
  const [status, setStatus] = useState<"idle" | "granted" | "denied">("idle");
  const [loading, setLoading] = useState(false);

  const requestLocation = async () => {
    setLoading(true);
    const { status: permission } = await Location.requestForegroundPermissionsAsync();
    if (permission === "granted") {
      const position = await Location.getCurrentPositionAsync({});
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("profiles")
          .update({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
          .eq("id", userData.user.id);
      }
      setStatus("granted");
    } else {
      setStatus("denied");
    }
    setLoading(false);
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Ionicons name="location" size={64} color={colors.primary} />
        <Text style={styles.title}>Bepaal je zoekgebied</Text>
        <Text style={styles.description}>
          In welke regio wil je mensen ontmoeten? Jouw adres wordt niet gedeeld met andere gebruikers.
        </Text>

        {status === "granted" ? (
          <Text style={styles.status}>Locatie ingesteld. We laten je nu sporters in de buurt zien.</Text>
        ) : status === "denied" ? (
          <Text style={styles.statusError}>
            Locatietoegang geweigerd. Je kunt dit later aanpassen in Instellingen.
          </Text>
        ) : null}

        <Button
          label="Kies dit zoekgebied"
          onPress={requestLocation}
          loading={loading}
          style={styles.cta}
        />
        <Text style={styles.skip} onPress={() => navigation.reset({ index: 0, routes: [{ name: "Home" }] })}>
          Overslaan
        </Text>
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
  cta: {
    marginTop: spacing.xl,
    width: "100%",
    borderRadius: radii.md,
  },
  skip: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
});
