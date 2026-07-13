import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";

export function DetailHeader({ title }: { title: string }) {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
        <Ionicons name="arrow-back" size={24} color={colors.black} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    textAlign: "center",
  },
  spacer: {
    width: 24,
  },
});
