import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

const logoMark = require("@/assets/logo-mark.png");

type Props = {
  /** Defaults to the "SPORTFREND" brand wordmark - some screens (e.g. Betalen, Figma node 2003:3596) show a page title here instead. */
  title?: string;
};

export function TopBar({ title = "SPORTFREND" }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image source={logoMark} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={() => navigation.navigate("PostsFeed")} style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color={colors.black} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => navigation.navigate("ChatList")} style={styles.iconButton}>
          <Ionicons name="mail-outline" size={22} color={colors.black} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  logo: {
    width: 26,
    height: 30,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  iconButton: {
    padding: spacing.xs,
  },
});
