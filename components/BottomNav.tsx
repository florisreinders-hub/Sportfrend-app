import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

export type BottomNavTab = "profiel" | "home" | "filter" | "menu";

type NavItem = {
  key: BottomNavTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
};

const items: NavItem[] = [
  { key: "profiel", label: "Profiel", icon: "person-outline", route: "Profile" },
  { key: "home", label: "Home", icon: "home-outline", route: "Home" },
  { key: "filter", label: "Filter", icon: "options-outline", route: "Filter" },
  { key: "menu", label: "Menu", icon: "menu-outline", route: "Menu" },
];

type Props = {
  active: BottomNavTab;
};

export function BottomNav({ active }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.container}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.key}
            onPress={() => navigation.navigate(item.route as any)}
            style={styles.item}
            hitSlop={8}
          >
            <Ionicons name={item.icon} size={24} color={colors.black} style={isActive ? styles.activeIcon : undefined} />
            <Text style={styles.label}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: BOTTOM_NAV_HEIGHT,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 12,
    paddingTop: 12,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activeIcon: {
    transform: [{ scale: 1.1 }],
  },
  label: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    color: colors.black,
  },
});
