import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { signUpWithEmail } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterDetails">;

export default function RegisterDetailsScreen({ route, navigation }: Props) {
  const { email, password } = route.params;
  const [repeatPassword, setRepeatPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [gender, setGender] = useState<"man" | "vrouw">("man");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password !== repeatPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await signUpWithEmail(email, password);
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        birthdate: birthdate || null,
        gender,
      });
    }
    setLoading(false);
    navigation.navigate("LocationSetup");
  };

  return (
    <ScreenContainer>
      <View style={styles.form}>
        <Input placeholder="Geboortedatum (DD-MM-JJJJ)" value={birthdate} onChangeText={setBirthdate} />

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

        <Input placeholder="E-mail" value={email} editable={false} />
        <Input placeholder="Wachtwoord" secureTextEntry value={password} editable={false} />
        <Input
          placeholder="Herhaal Wachtwoord"
          secureTextEntry
          value={repeatPassword}
          onChangeText={setRepeatPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Volgende" onPress={onSubmit} loading={loading} style={styles.cta} />
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
});
