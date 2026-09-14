import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { TrainingCard } from "@/components/TrainingCard";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchMyAcceptedTrainings, getDataErrorMessage, TrainingWithMatch } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "MyTrainings">;

/**
 * "Mijn trainingen" (Instellingen): every training this account has
 * accepted, upcoming first (soonest first) then verlopen (most recent
 * first) - see fetchMyAcceptedTrainings() for why this isn't itself
 * plan-gated (a Basis/Premium account can be the recipient of an Elite
 * match's proposal and should still see it here once accepted).
 */
export default function MyTrainingsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<TrainingWithMatch[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchMyAcceptedTrainings()
        .then((rows) => {
          if (!cancelled) setTrainings(rows);
        })
        .catch((e) => {
          console.warn("[MyTrainingsScreen] Kon trainingen niet ophalen:", e);
          if (!cancelled) Alert.alert("Kon trainingen niet laden", getDataErrorMessage(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const now = Date.now();
  const withTimestamp = trainings.map((t) => ({ t, at: new Date(`${t.date}T${t.time}`).getTime() }));
  const upcoming = withTimestamp.filter((x) => x.at >= now).sort((a, b) => a.at - b.at);
  const past = withTimestamp.filter((x) => x.at < now).sort((a, b) => b.at - a.at);

  const renderTraining = (training: TrainingWithMatch) => {
    const other = training.match.user_a_id === userId ? training.match.user_b : training.match.user_a;
    return (
      <View key={training.id} style={styles.item}>
        <View style={styles.partnerRow}>
          <Image source={{ uri: other?.photo_url || other?.avatar_url || undefined }} style={styles.partnerAvatar} />
          <Text style={styles.partnerName}>{other?.full_name ?? "Sportmaatje"}</Text>
        </View>
        <TrainingCard training={training} viewerId={userId ?? ""} otherName={other?.full_name ?? "je sportmaatje"} />
      </View>
    );
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Mijn trainingen" />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : trainings.length === 0 ? (
        <Text style={styles.empty}>
          Nog geen geaccepteerde trainingen. Plan er een via een chat met een sportmaatje (Elite-functie).
        </Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Aankomend</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.sectionEmpty}>Geen aankomende trainingen.</Text>
          ) : (
            upcoming.map((x) => renderTraining(x.t))
          )}

          <Text style={styles.sectionTitle}>Verlopen</Text>
          {past.length === 0 ? (
            <Text style={styles.sectionEmpty}>Nog geen verlopen trainingen.</Text>
          ) : (
            past.map((x) => renderTraining(x.t))
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
  item: {
    marginBottom: spacing.sm,
  },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 4,
  },
  partnerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  partnerName: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.black,
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
