import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/types";
import { useAuth } from "@/lib/AuthContext";
import { fetchUnreadNotificationCount } from "@/lib/api";

const logoMark = require("@/assets/logo-mark.png");

type Props = {
  /** Defaults to the "SPORTFREND" brand wordmark - some screens (e.g. Betalen, Figma node 2003:3596) show a page title here instead. */
  title?: string;
};

export function TopBar({ title = "SPORTFREND" }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [unreadCount, setUnreadCount] = useState(0);

  // TopBar is rendered inside many different screens (not itself a
  // navigator screen), but useFocusEffect still works from any descendant
  // of a focused screen - refetches whenever whichever screen currently
  // renders this TopBar comes into focus, e.g. right after backing out of
  // NotificationsScreen having just marked something read.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      fetchUnreadNotificationCount(userId)
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch((e) => console.warn("[TopBar] Kon aantal ongelezen meldingen niet ophalen:", e));
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image source={logoMark} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={() => navigation.navigate("Notifications")} style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={22} color={colors.black} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          ) : null}
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
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 9,
    color: colors.white,
  },
});
