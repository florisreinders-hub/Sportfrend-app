import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { getDataErrorMessage, sendDataExportEmail } from "@/lib/api";
import { fetchDataExport, formatDataExportText } from "@/lib/dataExport";

type Props = NativeStackScreenProps<RootStackParamList, "DataExport">;

/**
 * "Mijn gegevens opvragen" (recht op inzage/dataportabiliteit, AVG) -
 * shows a readable export of everything tied to this account (profiel,
 * matches, berichten, posts, swipes, abonnement, klantenservice-aanvragen,
 * rapportages, blokkades - see lib/dataExport.ts) and offers sending the
 * same text to the account's own registered e-mail address.
 */
export default function DataExportScreen(_props: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setLoading(true);
      setError(null);
      setSent(false);
      fetchDataExport(userId)
        .then((data) => {
          if (cancelled) return;
          setText(formatDataExportText(data, userId, userEmail));
        })
        .catch((e) => {
          if (!cancelled) setError(getDataErrorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [userId, userEmail])
  );

  const onSendEmail = async () => {
    setSending(true);
    try {
      await sendDataExportEmail(text);
      setSent(true);
    } catch (e) {
      Alert.alert("Versturen mislukt", getDataErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Mijn gegevens" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <View style={styles.actions}>
            <Text style={styles.intro}>
              Dit is een overzicht van alle gegevens die aan jouw account gekoppeld zijn. Je kunt het hieronder
              doorlezen, of naar {userEmail || "je e-mailadres"} laten sturen.
            </Text>
            {sent ? (
              <Text style={styles.confirmation}>Verstuurd! Check je inbox.</Text>
            ) : (
              <Button label="Verstuur naar mijn e-mail" onPress={onSendEmail} loading={sending} />
            )}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.exportText}>{text}</Text>
          </ScrollView>
        </>
      )}

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  actions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  confirmation: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
    textAlign: "center",
  },
  scroll: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  scrollContent: {
    padding: spacing.md,
    // BottomNav is an absolute-positioned overlay, not reserved flex space
    // (see app/home/HomeScreen.tsx's actionRow fix) - without this, the
    // tail end of a long export would always be hidden underneath it, even
    // at max scroll.
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.md,
  },
  exportText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.black,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
