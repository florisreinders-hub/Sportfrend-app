import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";

/**
 * Android is edge-to-edge since Expo SDK 54 (see the keyboard-handling fix
 * for the same root cause) - the system nav bar (gesture pill or 3-button
 * bar) floats on top of this absolutely-positioned, bottom:0 bar instead
 * of reserving its own space, so without this the system buttons sit on
 * top of (and steal taps from) BottomNav's own icons. The Platform check
 * matters here: `insets.bottom` is also non-zero on iOS (the home
 * indicator), but iOS already looks correct there and must stay pixel-
 * identical, so this is deliberately Android-only, not a no-op guard.
 *
 * Every screen that reserves clearance above BottomNav via
 * BOTTOM_NAV_HEIGHT (so its own content doesn't land underneath the
 * painted-on-top bar) needs this same extra amount added on Android, or
 * the bar's new, taller-on-Android height would start covering content
 * that used to just barely clear the old, fixed height.
 */
export function useBottomNavHeight(): number {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_HEIGHT + (Platform.OS === "android" ? insets.bottom : 0);
}

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
  // Only the extra bit beyond the old fixed height - added below the
  // icons (via paddingBottom), not distributed by alignItems: "center",
  // so the icons themselves stay exactly where they always were and the
  // green background simply extends further down behind the system bar.
  const androidNavBarInset = useBottomNavHeight() - BOTTOM_NAV_HEIGHT;

  return (
    <View
      style={[
        styles.container,
        { height: BOTTOM_NAV_HEIGHT + androidNavBarInset, paddingBottom: 12 + androidNavBarInset },
      ]}
    >
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
