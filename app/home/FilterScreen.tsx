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
import { SelectModal } from "@/components/SelectModal";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { DEFAULT_FILTERS, useDiscoverFilters } from "@/lib/FilterContext";
import { SPORT_OPTIONS } from "@/constants/sports";
import { LEVEL_OPTIONS } from "@/constants/levels";

type Props = NativeStackScreenProps<RootStackParamList, "Filter">;

export default function FilterScreen({ navigation }: Props) {
  const { filters, setFilters, resetFilters } = useDiscoverFilters();
  const [maxAge, setMaxAge] = useState(filters.maxAge);
  const [distanceKm, setDistanceKm] = useState(filters.distanceKm);
  const [sport, setSport] = useState<string | null>(filters.sport);
  const [level, setLevel] = useState<string | null>(filters.level);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);

  const sportLabel = SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Alle sporten";
  const levelLabel = LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? "Alle niveaus";

  const apply = () => {
    setFilters({ maxAge, distanceKm, sport, level });
    navigation.navigate("Home", { tab: "ontdekken" });
  };

  const reset = () => {
    resetFilters();
    setMaxAge(DEFAULT_FILTERS.maxAge);
    setDistanceKm(DEFAULT_FILTERS.distanceKm);
    setSport(DEFAULT_FILTERS.sport);
    setLevel(DEFAULT_FILTERS.level);
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>FILTER</Text>
      <View style={styles.divider} />

      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={styles.label}>LEEFTIJD</Text>
          <Text style={styles.value}>18-{Math.round(maxAge)}</Text>
        </View>
        <SliderControl value={maxAge} minimumValue={18} maximumValue={90} onValueChange={setMaxAge} />

        <View style={styles.row}>
          <Text style={styles.label}>AFSTAND</Text>
          <Text style={styles.value}>{Math.round(distanceKm)}KM</Text>
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
          <Pressable style={styles.pill} onPress={() => setLevelPickerVisible(true)}>
            <Text style={styles.pillText}>{levelLabel.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.black} />
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
      step={1}
      minimumTrackTintColor={colors.primary}
      maximumTrackTintColor={colors.border}
      thumbTintColor={colors.black}
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
  apply: {
    marginTop: spacing.xl,
  },
  reset: {
    marginTop: spacing.sm,
  },
});
