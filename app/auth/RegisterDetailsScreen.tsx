import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { getAuthErrorMessage, signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

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

  const passwordRef = useRef<TextInput>(null);
  const repeatPasswordRef = useRef<TextInput>(null);
  const birthdateRef = useRef<TextInput>(null);

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
        // they confirm and log in - EditProfile lets them fill it in too.
        setInfo(
          `We hebben een bevestigingslink gestuurd naar ${email.trim()}. Bevestig je e-mailadres en log daarna in om verder te gaan.`
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

      navigation.reset({ index: 0, routes: [{ name: "LocationSetup" }] });
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
});
