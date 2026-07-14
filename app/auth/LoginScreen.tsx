import React, { useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { getAuthErrorMessage, signInWithEmail } from "@/lib/auth";

const logoFull = require("@/assets/logo-full.png");

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await signInWithEmail(email.trim(), password);
      if (signInError) {
        setError(getAuthErrorMessage(signInError));
      }
      // On success, AuthContext's onAuthStateChange picks up the new session
      // and RootNavigator automatically swaps to the signed-in stack.
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.hero}>
          <Image source={logoFull} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>Sign in</Text>

          <Input
            placeholder="E-mail"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="next"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError(null);
            }}
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />
          <Input
            ref={passwordRef}
            placeholder="Wachtwoord"
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            returnKeyType="done"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError(null);
            }}
            onSubmitEditing={onSubmit}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Volgende" onPress={onSubmit} loading={loading} disabled={!canSubmit} style={styles.cta} />

          <Text style={styles.link} onPress={() => navigation.navigate("ForgotPassword")}>
            Wachtwoord vergeten
          </Text>
          <Text style={styles.link} onPress={() => navigation.navigate("Register")}>
            Nog geen account? Registreer
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    alignItems: "center",
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  logo: {
    width: 220,
    height: 194,
  },
  form: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  title: {
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
