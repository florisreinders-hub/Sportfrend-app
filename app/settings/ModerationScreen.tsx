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
import { MODERATOR_EMAIL } from "@/constants/moderator";
import { deleteAccount } from "@/lib/auth";
import {
  fetchOpenReports,
  fetchRecentFlaggedContent,
  getDataErrorMessage,
  ModerationFlaggedContent,
  ModerationReport,
  resolveReport,
} from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Moderation">;

const dateFmt = (iso: string) => new Date(iso).toLocaleString("nl-NL");

/**
 * Alleen bedoeld voor MODERATOR_EMAIL - zie dat bestand voor waarom dit
 * client-side gate puur UX is, geen beveiliging. Geen navigatielink hier
 * naartoe wordt ooit getoond aan een ander account (SettingsScreen.tsx),
 * en zelfs met de route-naam geraden RLS levert de queries hieronder voor
 * iedereen behalve de moderator gewoon een lege set op (of een fout bij
 * de update-acties) - is_moderator() in de database
 * (0029_moderation_dashboard.sql) is de echte grens.
 */
export default function ModerationScreen({ navigation }: Props) {
  const { session } = useAuth();
  const isModerator = session?.user?.email === MODERATOR_EMAIL;

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [flagged, setFlagged] = useState<ModerationFlaggedContent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!isModerator) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([fetchOpenReports(), fetchRecentFlaggedContent()])
      .then(([r, f]) => {
        setReports(r);
        setFlagged(f);
      })
      .catch((e) => {
        console.warn("[ModerationScreen] Kon overzicht niet laden:", e);
        Alert.alert("Kon overzicht niet laden", getDataErrorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [isModerator]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onResolveReport = async (report: ModerationReport) => {
    setBusyId(report.id);
    try {
      await resolveReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
    } catch (e) {
      Alert.alert("Afhandelen mislukt", getDataErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const onDeleteUser = (userId: string, name: string) => {
    Alert.alert(
      "Gebruiker verwijderen",
      `Weet je zeker dat je het account van ${name} permanent wilt verwijderen? Dit kan niet ongedaan gemaakt worden.`,
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Verwijderen",
          style: "destructive",
          onPress: async () => {
            setBusyId(userId);
            try {
              await deleteAccount(userId);
              setReports((prev) => prev.filter((r) => r.reported_id !== userId));
              setFlagged((prev) => prev.filter((f) => f.user_id !== userId));
            } catch (e) {
              Alert.alert("Verwijderen mislukt", getDataErrorMessage(e));
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  if (!isModerator) {
    return (
      <ScreenContainer withBottomPadding={false}>
        <DetailHeader title="Moderatie" />
        <Text style={styles.empty}>Geen toegang.</Text>
        <BottomNav active="menu" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Moderatie" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Openstaande rapportages ({reports.length})</Text>
          {reports.length === 0 ? (
            <Text style={styles.sectionEmpty}>Geen openstaande rapportages.</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.card}>
                <Text style={styles.cardTitle}>
                  {report.reporter?.full_name ?? "Onbekend"} → {report.reported?.full_name ?? "Onbekend"}
                </Text>
                <Text style={styles.cardMeta}>{dateFmt(report.created_at)}</Text>
                <Text style={styles.cardBody}>Reden: {report.reason}</Text>
                {report.details ? <Text style={styles.cardBody}>{report.details}</Text> : null}
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{report.status}</Text>
                </View>
                <View style={styles.actions}>
                  <Button
                    label="Afgehandeld"
                    variant="outline"
                    onPress={() => onResolveReport(report)}
                    loading={busyId === report.id}
                    disabled={busyId !== null && busyId !== report.id}
                    style={styles.actionButton}
                  />
                  <Button
                    label="Verwijder gebruiker"
                    variant="danger"
                    onPress={() => onDeleteUser(report.reported_id, report.reported?.full_name ?? "deze gebruiker")}
                    loading={busyId === report.reported_id}
                    disabled={busyId !== null && busyId !== report.reported_id}
                    style={styles.actionButton}
                  />
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Recent gemarkeerde content ({flagged.length})</Text>
          {flagged.length === 0 ? (
            <Text style={styles.sectionEmpty}>Nog geen gemarkeerde content.</Text>
          ) : (
            flagged.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.cardTitle}>{row.user?.full_name ?? "Onbekend"}</Text>
                <Text style={styles.cardMeta}>
                  {row.source_table} · {dateFmt(row.created_at)}
                </Text>
                <Text style={styles.cardBody}>Woord(en): {row.matched_words.join(", ")}</Text>
                <View style={styles.actions}>
                  <Button
                    label="Verwijder gebruiker"
                    variant="danger"
                    onPress={() => onDeleteUser(row.user_id, row.user?.full_name ?? "deze gebruiker")}
                    loading={busyId === row.user_id}
                    disabled={busyId !== null && busyId !== row.user_id}
                    style={styles.actionButton}
                  />
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionEmpty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
    marginTop: spacing.xs,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  statusPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
