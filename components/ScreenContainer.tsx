import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  withBottomPadding?: boolean;
};

export function ScreenContainer({ children, style, edges = ["top", "left", "right"], withBottomPadding = true }: Props) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View style={[styles.content, withBottomPadding && styles.bottomPadding, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bottomPadding: {
    paddingBottom: 90,
  },
});
