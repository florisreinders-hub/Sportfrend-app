import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { getAuthErrorMessage, resendConfirmationEmail, signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const RESEND_COOLDOWN_SECONDS = 60;

type Props = NativeStackScreenProps<RootStackParamList, "RegisterDetails">;

/** "DD-MM-JJJJ" -> ISO "YYYY-MM-DD", or null if not a real calendar date. */
function parseDutchBirthdate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  const isPast = date.getTime() < Date.now();
  if (!isRealDate || !isPast) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export default function RegisterDetailsScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<"man" | "vrouw">("man");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const passwordRef = useRef<TextInput>(null);
  const repeatPasswordRef = useRef<TextInput>(null);
  const birthdateRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onResend = async () => {
    setResendError(null);
    setResendMessage(null);
    setResending(true);
    try {
      const { error: resendCallError } = await resendConfirmationEmail(email.trim());
      if (resendCallError) {
        setResendError(getAuthErrorMessage(resendCallError));
        return;
      }
      setResendMessage("Nieuwe bevestigingsmail verstuurd.");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setResendError(getAuthErrorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const canSubmit = email.trim().length > 0 && password.length > 0 && repeatPassword.length > 0 && !loading;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setInfo(null);

    if (password !== repeatPassword) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }

    let isoBirthdate: string | null = null;
    if (birthdate.trim()) {
      isoBirthdate = parseDutchBirthdate(birthdate);
      if (!isoBirthdate) {
        setError("Vul een geldige geboortedatum in (DD-MM-JJJJ).");
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await signUpWithEmail(email.trim(), password);

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError));
        return;
      }

      // Supabase hides whether an email is already registered by returning a
      // "successful" signUp with an empty identities array instead of an
      // error, when the address already belongs to a confirmed account.
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("Dit e-mailadres is al geregistreerd. Log in of gebruik een ander e-mailadres.");
        return;
      }

      if (!data.session) {
        // Email confirmation is required on this project: there's no
        // authenticated session yet, so we can't write to `profiles` (RLS
        // requires auth.uid() = id). The birthdate/gender get saved once
        // they confirm - EditProfile lets them fill it in too. Tapping the
        // link opens the app via the sportfrend:// scheme and signs them in
        // automatically (see lib/deepLinking.ts), no manual login needed.
        setInfo(
          `We hebben een bevestigingslink gestuurd naar ${email.trim()}. Open de link vanaf dit toestel om je e-mailadres te bevestigen - je wordt dan automatisch ingelogd.`
        );
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            { id: data.user.id, birthdate: isoBirthdate, gender },
            { onConflict: "id" }
          );
        if (profileError) {
          setError(getAuthErrorMessage(profileError));
          return;
        }
      }

      // No explicit navigation needed: the session is already set at this
      // point, so AuthContext's onAuthStateChange picks it up and
      // RootNavigator swaps to the signed-in stack automatically - landing
      // on LocationSetup since this profile has no location yet (see
      // RootNavigator's initialRouteName).
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (info) {
    return (
      <ScreenContainer>
        <View style={styles.form}>
          <Text style={styles.info}>{info}</Text>

          {resendMessage ? <Text style={styles.resendSuccess}>{resendMessage}</Text> : null}
          {resendError ? <Text style={styles.error}>{resendError}</Text> : null}

          <Button
            label={resendCooldown > 0 ? `Opnieuw versturen (${resendCooldown}s)` : "Bevestigingsmail opnieuw versturen"}
            onPress={onResend}
            loading={resending}
            disabled={resendCooldown > 0}
            variant="outline"
            style={styles.cta}
          />
          <Button label="Naar inloggen" onPress={() => navigation.navigate("Login")} style={styles.cta} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.form}>
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
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (error) setError(null);
          }}
          onSubmitEditing={() => repeatPasswordRef.current?.focus()}
          blurOnSubmit={false}
        />
        <Input
          ref={repeatPasswordRef}
          placeholder="Herhaal wachtwoord"
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
          returnKeyType="next"
          value={repeatPassword}
          onChangeText={(text) => {
            setRepeatPassword(text);
            if (error) setError(null);
          }}
          onSubmitEditing={() => birthdateRef.current?.focus()}
          blurOnSubmit={false}
        />
        <Input
          ref={birthdateRef}
          placeholder="Geboortedatum (DD-MM-JJJJ)"
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
          value={birthdate}
          onChangeText={(text) => {
            setBirthdate(text);
            if (error) setError(null);
          }}
          onSubmitEditing={onSubmit}
        />

        <Text style={styles.label}>Kies geslacht</Text>
        <View style={styles.genderRow}>
          <Pressable
            onPress={() => setGender("man")}
            style={[styles.genderPill, gender === "man" && styles.genderPillActive]}
          >
            <Text style={styles.genderLabel}>Man ♂</Text>
          </Pressable>
          <Pressable
            onPress={() => setGender("vrouw")}
            style={[styles.genderPill, gender === "vrouw" && styles.genderPillActive]}
          >
            <Text style={styles.genderLabel}>Vrouw ♀</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Volgende" onPress={onSubmit} loading={loading} disabled={!canSubmit} style={styles.cta} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  genderRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  genderPill: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  genderPillActive: {
    backgroundColor: colors.primary,
  },
  genderLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
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
  info: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  resendSuccess: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
});
