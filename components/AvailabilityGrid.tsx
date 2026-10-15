import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { availabilityKey, DAYPART_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/api";

type Props = {
  value: string[];
  onToggle: (key: string) => void;
  /** Locked state (e.g. FilterScreen's Elite-only gate) - renders dimmed and non-interactive except for onLockedPress. */
  locked?: boolean;
  onLockedPress?: () => void;
  style?: ViewStyle;
};

/**
 * One row per weekday, 3 dagdeel chips (ochtend/middag/avond) each -
 * shared by FilterScreen (search filter, Elite-only) and
 * AvailabilityScreen ("Mijn beschikbaarheid", all users), so both use the
 * exact same interaction and layout. Each chip is flex:1 with a minHeight
 * (not a fixed height, same reasoning as Button.tsx) so a longer label at
 * a larger system font size wraps/grows the chip instead of clipping, and
 * stays usable on a narrow screen since the 3 chips always share the
 * row's available width instead of a fixed per-chip width.
 */
export function AvailabilityGrid({ value, onToggle, locked, onLockedPress, style }: Props) {
  return (
    <View style={[styles.grid, style]}>
      {WEEKDAY_OPTIONS.map((day) => (
        <View key={day.key} style={styles.dayRow}>
          <Text style={[styles.dayLabel, locked && styles.textLocked]} numberOfLines={1}>
            {day.label}
          </Text>
          <View style={styles.chipRow}>
            {DAYPART_OPTIONS.map((part) => {
              const key = availabilityKey(day.key, part.key);
              const selected = value.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => (locked ? onLockedPress?.() : onToggle(key))}
                  hitSlop={2}
                  style={styles.chipFlex}
                >
                  <View
                    pointerEvents={locked ? "none" : "auto"}
                    style={[styles.chip, selected && styles.chipSelected, locked && styles.chipLocked]}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextSelected, locked && styles.textLocked]}
                      numberOfLines={2}
                    >
                      {part.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dayLabel: {
    minWidth: 24,
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  chipRow: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
  },
  chipFlex: {
    flex: 1,
  },
  chip: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipLocked: {
    opacity: 0.6,
  },
  chipText: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    color: colors.black,
    textAlign: "center",
  },
  chipTextSelected: {
    color: colors.black,
  },
  textLocked: {
    color: colors.textSecondary,
  },
});
