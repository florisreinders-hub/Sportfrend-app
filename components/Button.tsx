import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Variant = "primary" | "danger" | "outline" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = "primary", disabled, loading, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? colors.primary : colors.black} />
      ) : (
        <Text style={[styles.label, variant === "outline" || variant === "ghost" ? styles.labelOutline : styles.labelSolid]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    // minHeight (not a fixed height): a long label, a narrow screen, or a
    // larger system font size can all make the label wrap onto a second
    // line - a fixed height would leave that second line clipped instead
    // of growing the button to fit. A short label at the default font
    // size still renders at exactly this 48px floor, same as before.
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: spacing.sm,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    textAlign: "center",
  },
  labelSolid: {
    color: colors.black,
  },
  labelOutline: {
    color: colors.primary,
  },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  outline: { backgroundColor: "transparent", borderColor: colors.primary },
  ghost: { backgroundColor: "transparent", borderColor: "transparent" },
};
