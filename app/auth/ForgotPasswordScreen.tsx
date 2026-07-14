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

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    const { error: resetError } = await sendPasswordReset(email.trim());
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
          <Text style={styles.info}>
            We hebben een e-mail gestuurd naar {email} met instructies om je wachtwoord te resetten.
          </Text>
        ) : (
          <Input
            placeholder="E-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
          />
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label="Volgende"
          onPress={sent ? () => navigation.navigate("Login") : onSubmit}
          loading={loading}
          disabled={!sent && !email}
          style={styles.cta}
        />
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
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
