import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { getAuthErrorMessage, sendPasswordReset } from "@/lib/auth";

const logoFull = require("@/assets/logo-full.png");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);

    const trimmedEmail = email.trim();
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("Dit is geen geldig e-mailadres.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await sendPasswordReset(trimmedEmail);
    setLoading(false);
    if (resetError) {
      setError(getAuthErrorMessage(resetError));
      return;
    }
    setSent(true);
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.hero}>
        <Image source={logoFull} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.form}>
        {sent ? (
          <>
            <Text style={styles.info}>
              Als {email.trim()} bij ons bekend is, ontvang je een e-mail met een link om je wachtwoord opnieuw in te
              stellen.
            </Text>
            <Button label="Naar inloggen" onPress={() => navigation.navigate("Login")} style={styles.cta} />
            <Text
              style={styles.link}
              onPress={() => {
                setSent(false);
                setError(null);
              }}
            >
              Ander e-mailadres proberen
            </Text>
          </>
        ) : (
          <>
            <Input
              placeholder="E-mail"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="done"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              onSubmitEditing={onSubmit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Volgende"
              onPress={onSubmit}
              loading={loading}
              disabled={!email.trim() || loading}
              style={styles.cta}
            />
            <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
              Terug naar inloggen
            </Text>
          </>
        )}
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
    width: 220,
    height: 194,
  },
  form: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  info: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  cta: {
    alignSelf: "center",
    width: 160,
    marginTop: spacing.sm,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.md,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
