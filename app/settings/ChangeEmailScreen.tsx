import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";

type Props = NativeStackScreenProps<RootStackParamList, "ChangeEmail">;

export default function ChangeEmailScreen({ navigation }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSent(true);
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="E-mail wijzigen" />
      <View style={styles.content}>
        {sent ? (
          <Text style={styles.confirmation}>
            We hebben een bevestigingslink gestuurd naar {newEmail}. Bevestig de wijziging via die e-mail.
          </Text>
        ) : (
          <>
            <Text style={styles.intro}>Vul je nieuwe e-mailadres in. We sturen een bevestigingslink.</Text>
            <Input
              label="Nieuw e-mailadres"
              placeholder="naam@voorbeeld.nl"
              autoCapitalize="none"
              keyboardType="email-address"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <Input
              label="Wachtwoord ter bevestiging"
              placeholder="Wachtwoord"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Opslaan"
              onPress={onSubmit}
              loading={loading}
              disabled={!newEmail.trim() || !password}
              style={styles.cta}
            />
          </>
        )}
      </View>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    marginBottom: spacing.md,
  },
  cta: {
    marginTop: spacing.sm,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  confirmation: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
