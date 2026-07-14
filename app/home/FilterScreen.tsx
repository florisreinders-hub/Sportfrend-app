import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { DEFAULT_FILTERS, useDiscoverFilters } from "@/lib/FilterContext";

// null = "Alle sporten" / "Alle niveaus", i.e. no filter on that field.
const SPORTS: (string | null)[] = [null, "Padel", "Tennis", "Golf", "Hardlopen", "Fitness"];
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
  const [sportIndex, setSportIndex] = useState(Math.max(0, SPORTS.indexOf(filters.sport)));
  const [levelIndex, setLevelIndex] = useState(Math.max(0, LEVELS.indexOf(filters.level)));

  const apply = () => {
    setFilters({ maxAge, distanceKm, sport: SPORTS[sportIndex], level: LEVELS[levelIndex] });
    navigation.navigate("Home", { tab: "ontdekken" });
  };

  const reset = () => {
    resetFilters();
    setMaxAge(DEFAULT_FILTERS.maxAge);
    setDistanceKm(DEFAULT_FILTERS.distanceKm);
    setSportIndex(0);
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
          <Pressable
            style={styles.pill}
            onPress={() => setSportIndex((sportIndex + 1) % SPORTS.length)}
          >
            <Text style={styles.pillText}>{(SPORTS[sportIndex] ?? "Alle sporten").toUpperCase()}</Text>
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
