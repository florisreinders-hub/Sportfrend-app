import React, { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /**
   * Style for the outer wrapping View (e.g. `flex: 1` to make the field
   * share a row with a sibling). `style` only reaches the inner TextInput,
   * so a caller that needs the *field itself* to grow within a row - not
   * just its text box - must use this instead: `flex` only resolves against
   * an item's immediate parent, and the wrapper here has no size of its own
   * to hand a flexed TextInput.
   */
  containerStyle?: ViewStyle;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, style, containerStyle, ...rest },
  ref
) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});
