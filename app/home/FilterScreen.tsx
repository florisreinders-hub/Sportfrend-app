import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { SelectModal } from "@/components/SelectModal";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { DEFAULT_FILTERS, DiscoverFilters, useDiscoverFilters } from "@/lib/FilterContext";
import { SPORT_OPTIONS } from "@/constants/sports";
import { LEVEL_OPTIONS } from "@/constants/levels";
import { fetchDiscoverDailyStatus } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Filter">;

// Basis-abonnees op de Pricing-tabel: alleen Sport en Afstand
// ("Basisfilters"), Afstand begrensd op 50km. Premium/Elite: alle vier
// ("Uitgebreide filters"), Afstand tot 150km. Dit scherm grijst Leeftijd/
// Niveau alleen uit voor Basis - discover_profiles() (SECURITY DEFINER,
// 0021_discover_profiles_plan_filters.sql) is de echte grens en negeert/
// begrenst deze waarden hoe dan ook server-side, dus dit is puur UX, geen
// beveiliging.
const BASIS_MAX_DISTANCE_KM = 50;

export default function FilterScreen({ navigation }: Props) {
  const { filters, setFilters } = useDiscoverFilters();
  const [maxAge, setMaxAge] = useState(filters.maxAge);
  const [distanceKm, setDistanceKm] = useState(filters.distanceKm);
  const [sport, setSport] = useState<string | null>(filters.sport);
  const [level, setLevel] = useState<string | null>(filters.level);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);
  const [plan, setPlan] = useState<"basis" | "premium" | "elite" | null>(null);

  // useFocusEffect, not a plain mount-only useEffect: BottomNav reaches
  // this screen via navigation.navigate("Filter"), and React Navigation's
  // native-stack navigate() does NOT remount a screen already sitting in
  // the stack - it just brings the existing instance back into focus. A
  // mount-only fetch here would run exactly once per app session (on the
  // very first visit) and never again, so a plan that changes afterwards -
  // or simply wasn't fully set up yet on that very first visit - would
  // silently keep showing the stale result on every later visit, with the
  // UI never actually locking despite the account genuinely being Basis.
  useFocusEffect(
    useCallback(() => {
      fetchDiscoverDailyStatus()
        .then((status) => setPlan(status.plan))
        .catch((e) => {
          // Not silently dropped, same reasoning as the fix applied to
          // HomeScreen/ChatDetailScreen's own daily-status fetches: a
          // failure here most likely means this RPC (or the plan-filter
          // clamp inside discover_profiles() itself) isn't deployed to
          // this project's database yet - see
          // 0021_discover_profiles_plan_filters.sql. Plan stays at
          // whatever it was before (or null on first load), which this
          // screen treats as "don't lock anything" - discover_profiles()
          // still enforces the real Basis limits server-side regardless,
          // so this only affects whether the UI *shows* the lock, never
          // whether it's actually enforced.
          console.warn("[FilterScreen] Kon abonnement niet ophalen:", e);
        });
    }, [])
  );

  // A stale cached distance above the Basis cap (e.g. from before a
  // downgrade, or simply this screen's default of 150) must not keep
  // showing on the slider once we know the plan is Basis.
  useEffect(() => {
    if (plan === "basis" && distanceKm > BASIS_MAX_DISTANCE_KM) {
      setDistanceKm(BASIS_MAX_DISTANCE_KM);
    }
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBasis = plan === "basis";
  const maxDistanceKm = isBasis ? BASIS_MAX_DISTANCE_KM : DEFAULT_FILTERS.distanceKm;

  const sportLabel = SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Alle sporten";
  const levelLabel = LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? "Alle niveaus";

  const apply = () => {
    // Leeftijd/Niveau can't actually have been changed from their defaults
    // while locked (the controls are disabled), but forcing them back to
    // "no filter" here too means a stale non-default value from before a
    // downgrade never gets silently re-applied once this screen saves.
    const next: DiscoverFilters = {
      maxAge: isBasis ? DEFAULT_FILTERS.maxAge : maxAge,
      distanceKm: isBasis ? Math.min(distanceKm, BASIS_MAX_DISTANCE_KM) : distanceKm,
      sport,
      level: isBasis ? null : level,
    };
    setFilters(next);
    navigation.navigate("Home", { tab: "ontdekken" });
  };

  const reset = () => {
    const next: DiscoverFilters = { ...DEFAULT_FILTERS, distanceKm: maxDistanceKm };
    setFilters(next);
    setMaxAge(next.maxAge);
    setDistanceKm(next.distanceKm);
    setSport(next.sport);
    setLevel(next.level);
  };

  const goToPricing = () => navigation.navigate("Pricing");

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>FILTER</Text>
      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, isBasis && styles.labelLocked]}>LEEFTIJD</Text>
            {isBasis ? <LockBadge /> : null}
          </View>
          <Text style={[styles.value, isBasis && styles.labelLocked]}>18-{Math.round(maxAge)}</Text>
        </View>
        {isBasis ? (
          <Pressable onPress={goToPricing} hitSlop={4}>
            <View pointerEvents="none">
              <SliderControl value={maxAge} minimumValue={18} maximumValue={90} onValueChange={() => {}} disabled />
            </View>
          </Pressable>
        ) : (
          <SliderControl value={maxAge} minimumValue={18} maximumValue={90} onValueChange={setMaxAge} />
        )}

        <View style={styles.row}>
          <Text style={styles.label}>AFSTAND</Text>
          <Text style={styles.value}>{Math.round(distanceKm)}KM</Text>
        </View>
        <SliderControl value={distanceKm} minimumValue={1} maximumValue={maxDistanceKm} onValueChange={setDistanceKm} />

        <View style={styles.row}>
          <Text style={styles.label}>SPORT</Text>
          <Pressable style={styles.pill} onPress={() => setSportPickerVisible(true)}>
            <Text style={styles.pillText}>{sportLabel.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.black} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, isBasis && styles.labelLocked]}>NIVEAU</Text>
            {isBasis ? <LockBadge /> : null}
          </View>
          <Pressable
            style={[styles.pill, isBasis && styles.pillLocked]}
            onPress={() => (isBasis ? goToPricing() : setLevelPickerVisible(true))}
          >
            {isBasis ? <Ionicons name="lock-closed" size={14} color={colors.textSecondary} /> : null}
            <Text style={[styles.pillText, isBasis && styles.pillTextLocked]}>
              {isBasis ? "PREMIUM" : levelLabel.toUpperCase()}
            </Text>
            {isBasis ? null : <Ionicons name="chevron-down" size={16} color={colors.black} />}
          </Pressable>
        </View>

        <Button label="Toepassen" onPress={apply} style={styles.apply} />
        <Button label="Reset filter" onPress={reset} variant="outline" style={styles.reset} />
      </View>

      <SelectModal
        visible={sportPickerVisible}
        title="Kies een sport"
        options={SPORT_OPTIONS}
        selectedValue={sport}
        onSelect={setSport}
        onClose={() => setSportPickerVisible(false)}
      />
      <SelectModal
        visible={levelPickerVisible}
        title="Kies een niveau"
        options={LEVEL_OPTIONS}
        selectedValue={level}
        onSelect={setLevel}
        onClose={() => setLevelPickerVisible(false)}
      />

      <BottomNav active="filter" />
    </ScreenContainer>
  );
}

function LockBadge() {
  return (
    <View style={styles.premiumBadge}>
      <Ionicons name="lock-closed" size={11} color={colors.textSecondary} />
      <Text style={styles.premiumBadgeText}>PREMIUM</Text>
    </View>
  );
}

function SliderControl({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  disabled,
}: {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <Slider
      style={[styles.slider, disabled && styles.sliderDisabled]}
      value={value}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={1}
      disabled={disabled}
      minimumTrackTintColor={disabled ? colors.border : colors.primary}
      maximumTrackTintColor={colors.border}
      thumbTintColor={disabled ? colors.textSecondary : colors.black}
      onValueChange={(v) => onValueChange(Math.round(v))}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  labelLocked: {
    color: colors.textSecondary,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  slider: {
    width: "100%",
    height: 32,
  },
  sliderDisabled: {
    opacity: 0.4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillLocked: {
    opacity: 0.6,
  },
  pillText: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  pillTextLocked: {
    color: colors.textSecondary,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  premiumBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.textSecondary,
  },
  apply: {
    marginTop: spacing.xl,
  },
  reset: {
    marginTop: spacing.sm,
  },
});
