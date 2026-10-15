import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchProfileSettings, getDataErrorMessage, updateProfileSettings } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Availability">;

/**
 * "Mijn beschikbaarheid" - self-declare per dag + dagdeel, available to
 * ALL users (unlike FilterScreen's "Slimme beschikbaarheids match"
 * zoekfilter, which stays Elite-only - see FilterScreen.tsx and
 * discover_profiles()'s plan clamp, both untouched here). Every user who
 * fills this in can be matched on it by an Elite searcher regardless of
 * their own plan.
 */
export default function AvailabilityScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [availabilityDays, setAvailabilityDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setLoading(true);
      fetchProfileSettings(userId)
        .then((settings) => {
          if (!cancelled) setAvailabilityDays(settings.availability_days);
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
    }, [userId])
  );

  const toggleKey = (key: string) => {
    setAvailabilityDays((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const onSave = async () => {
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      await updateProfileSettings(userId, { availability_days: availabilityDays });
      navigation.goBack();
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Mijn beschikbaarheid" />
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.intro}>
            Geef aan wanneer je beschikbaar bent om te sporten. Dit wordt gebruikt bij "Slimme beschikbaarheids
            match" (Elite) om je te laten vinden door anderen die op jouw momenten zoeken - je eigen gegevens zijn
            nooit zichtbaar voor andere gebruikers, alleen de match zelf.
          </Text>
          <AvailabilityGrid value={availabilityDays} onToggle={toggleKey} style={styles.grid} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Opslaan" onPress={onSave} loading={saving} style={styles.save} />
        </ScrollView>
      )}
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginTop: spacing.xl,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.md,
  },
  intro: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  grid: {
    marginBottom: spacing.md,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  save: {
    marginTop: spacing.sm,
  },
});
