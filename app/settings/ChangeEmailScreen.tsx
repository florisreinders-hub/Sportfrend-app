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
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getAuthErrorMessage } from "@/lib/auth";

type Props = NativeStackScreenProps<RootStackParamList, "ChangeEmail">;

export default function ChangeEmailScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const currentEmail = session?.user?.email;
    if (!currentEmail) {
      setError("Geen actieve sessie gevonden. Log opnieuw in en probeer het nogmaals.");
      return;
    }
    setLoading(true);
    try {
      // Re-verify the current password before allowing an email change -
      // the field was previously collected but never actually checked
      // against anything, so it looked like a security step without
      // being one.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (reauthError) throw reauthError;

      // Supabase's default "secure email change" setting sends a
      // confirmation link to the new address (and, depending on project
      // config, the old one too) - the change only takes effect once
      // that's confirmed, not immediately here.
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateError) throw updateError;

      setSent(true);
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="E-mail wijzigen" />
      <View style={styles.content}>
        {sent ? (
          <Text style={styles.confirmation}>
            We hebben een bevestigingslink gestuurd naar {newEmail}. Bevestig de wijziging via die e-mail voordat hij
            ingaat.
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
