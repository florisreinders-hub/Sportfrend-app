import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { signOut } from "@/lib/auth";

const logoFull = require("@/assets/logo-full.png");

type Props = NativeStackScreenProps<RootStackParamList, "EmailConfirmed">;

export default function EmailConfirmedScreen({ navigation }: Props) {
  useEffect(() => {
    // The confirmation deep link deliberately doesn't establish a session
    // (see lib/deepLinking.ts), but sign out defensively in case a session
    // from an earlier flow is still lingering, so this always lands on a
    // clean Login screen.
    signOut();
  }, []);

  const continueToLogin = () => {
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.hero}>
        <Image source={logoFull} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.content}>
        <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
        <Text style={styles.title}>E-mailadres bevestigd!</Text>
        <Text style={styles.description}>Je account is geactiveerd. Log in om verder te gaan met Sportfrend.</Text>
        <Button label="Verder naar inloggen" onPress={continueToLogin} style={styles.cta} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  logo: {
    width: 180,
    height: 159,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
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
  cta: {
    marginTop: spacing.xl,
    width: 220,
  },
});
