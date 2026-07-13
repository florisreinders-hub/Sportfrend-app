import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { signOut } from "@/lib/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Menu">;

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (navigation: Props["navigation"]) => void;
};

const items: MenuItem[] = [
  { label: "Berichten", icon: "chatbubbles-outline", onPress: (nav) => nav.navigate("ChatList") },
  { label: "Instellingen", icon: "settings-outline", onPress: (nav) => nav.navigate("Settings") },
  { label: "Premium & Elite", icon: "star-outline", onPress: (nav) => nav.navigate("Pricing") },
  { label: "Helpdesk", icon: "help-circle-outline", onPress: (nav) => nav.navigate("Helpdesk") },
];

export default function MenuScreen({ navigation }: Props) {
  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>MENU</Text>
      <View style={styles.divider} />

      <View style={styles.list}>
        {items.map((item) => (
          <Pressable key={item.label} style={styles.row} onPress={() => item.onPress(navigation)}>
            <Ionicons name={item.icon} size={22} color={colors.black} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={styles.chevron} />
          </Pressable>
        ))}

        <Pressable style={styles.row} onPress={() => signOut()}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={[styles.rowLabel, styles.logout]}>Uitloggen</Text>
        </Pressable>
      </View>

      <BottomNav active="menu" />
    </ScreenContainer>
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
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  chevron: {
    marginLeft: "auto",
  },
  logout: {
    color: colors.danger,
  },
});
