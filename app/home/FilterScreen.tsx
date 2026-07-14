import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { SelectModal, SelectOption } from "@/components/SelectModal";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { DEFAULT_FILTERS, useDiscoverFilters } from "@/lib/FilterContext";

// value: null = "Alle sporten", i.e. no sport filter.
const SPORT_OPTIONS: SelectOption[] = [
  { label: "Alle sporten", value: null },
  { label: "Padel", value: "Padel" },
  { label: "Tennis", value: "Tennis" },
  { label: "Golf", value: "Golf" },
  { label: "Hardlopen", value: "Hardlopen" },
  { label: "Fitness", value: "Fitness" },
  { label: "Voetbal", value: "Voetbal" },
  { label: "Basketbal", value: "Basketbal" },
  { label: "Volleybal", value: "Volleybal" },
  { label: "Badminton", value: "Badminton" },
  { label: "Squash", value: "Squash" },
  { label: "Wielrennen", value: "Wielrennen" },
  { label: "Zwemmen", value: "Zwemmen" },
  { label: "Klimmen", value: "Klimmen" },
  { label: "Yoga", value: "Yoga" },
  { label: "Crossfit", value: "Crossfit" },
];

const LEVELS: (string | null)[] = [null, "beginner", "gevorderd", "competitief"];
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  gevorderd: "Gevorderd",
  competitief: "Competitief",
};

type Props = NativeStackScreenProps<RootStackParamList, "Filter">;

export default function FilterScreen({ navigation }: Props) {
  const { filters, setFilters, resetFilters } = useDiscoverFilters();
  const [maxAge, setMaxAge] = useState(filters.maxAge);
  const [distanceKm, setDistanceKm] = useState(filters.distanceKm);
  const [sport, setSport] = useState<string | null>(filters.sport);
  const [levelIndex, setLevelIndex] = useState(Math.max(0, LEVELS.indexOf(filters.level)));
  const [sportPickerVisible, setSportPickerVisible] = useState(false);

  const sportLabel = SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Alle sporten";

  const apply = () => {
    setFilters({ maxAge, distanceKm, sport, level: LEVELS[levelIndex] });
    navigation.navigate("Home", { tab: "ontdekken" });
  };

  const reset = () => {
    resetFilters();
    setMaxAge(DEFAULT_FILTERS.maxAge);
    setDistanceKm(DEFAULT_FILTERS.distanceKm);
    setSport(DEFAULT_FILTERS.sport);
    setLevelIndex(0);
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>FILTER</Text>
      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>LEEFTIJD</Text>
          <Text style={styles.value}>18-{maxAge}</Text>
        </View>
        <SliderControl value={maxAge} minimumValue={18} maximumValue={90} onValueChange={setMaxAge} />

        <View style={styles.row}>
          <Text style={styles.label}>AFSTAND</Text>
          <Text style={styles.value}>{distanceKm}KM</Text>
        </View>
        <SliderControl value={distanceKm} minimumValue={1} maximumValue={150} onValueChange={setDistanceKm} />

        <View style={styles.row}>
          <Text style={styles.label}>SPORT</Text>
          <Pressable style={styles.pill} onPress={() => setSportPickerVisible(true)}>
            <Text style={styles.pillText}>{sportLabel.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.black} />
          </Pressable>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>NIVEAU</Text>
          <Pressable
            style={styles.pill}
            onPress={() => setLevelIndex((levelIndex + 1) % LEVELS.length)}
          >
            <Text style={styles.pillText}>
              {(LEVELS[levelIndex] ? LEVEL_LABELS[LEVELS[levelIndex]!] : "Alle niveaus").toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.label, styles.availabilityLabel]}>BESCHIKBAARHEID</Text>
        <Text style={styles.availabilityHint}>
          Kies dagen waarop je beschikbaar bent in je profielinstellingen.
        </Text>

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

      <BottomNav active="filter" />
    </ScreenContainer>
  );
}

function SliderControl({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
}: {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <Slider
      style={styles.slider}
      value={value}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      minimumTrackTintColor={colors.primary}
      maximumTrackTintColor={colors.border}
      thumbTintColor={colors.black}
      onValueChange={onValueChange}
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
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
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
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pillText: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  availabilityLabel: {
    marginTop: spacing.lg,
  },
  availabilityHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  apply: {
    marginTop: spacing.xl,
  },
  reset: {
    marginTop: spacing.sm,
  },
});
