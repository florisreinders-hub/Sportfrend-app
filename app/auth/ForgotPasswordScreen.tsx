import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { sendPasswordReset } from "@/lib/auth";

const logoFull = require("@/assets/logo-full.png");

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setLoading(true);
    await sendPasswordReset(email.trim());
    setLoading(false);
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
            onChangeText={setEmail}
          />
        )}
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
});
