import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { AppNotification, fetchNotifications, formatConversationTimestamp, getDataErrorMessage, markNotificationRead } from "@/lib/api";
import { avatarPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

function describeNotification(notification: AppNotification): string {
  const name = notification.otherUser?.full_name ?? "Sportmaatje";
  switch (notification.type) {
    case "match":
      return `Nieuwe match met ${name}`;
    case "message":
      return `Nieuw bericht van ${name}`;
    case "moderation_update":
      return "Je rapportage is afgehandeld";
  }
}

function iconForNotification(type: AppNotification["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "match":
      return "heart";
    case "message":
      return "chatbubble";
    case "moderation_update":
      return "shield-checkmark";
  }
}

export default function NotificationsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setNotifications(await fetchNotifications(userId));
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onPressNotification = async (notification: AppNotification) => {
    // Optimistic - the row shouldn't look unread anymore the instant it's
    // tapped, regardless of how long the markNotificationRead() round trip
    // takes (and regardless of whether it's already read, in which case
    // this is a harmless no-op update).
    setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    markNotificationRead(notification.id).catch((e) => {
      console.warn("[NotificationsScreen] Kon melding niet als gelezen markeren:", e);
    });

    // 'moderation_update' heeft geen chat/match om naartoe te navigeren
    // (net als een match/bericht-melding waarvan de match inmiddels niet
    // meer bestaat, bv. na "Vriend verwijderen" - otherUser is dan null) -
    // in beide gevallen blijft het bij alleen markeren als gelezen.
    if (notification.type === "moderation_update" || !notification.otherUser) return;

    navigation.navigate("ChatDetail", {
      chatId: notification.reference_id,
      name: notification.otherUser.full_name ?? "Sportmaatje",
      photo: notification.otherUser.photo_url ?? avatarPlaceholder(notification.otherUser.id),
      otherUserId: notification.otherUser.id,
    });
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.sectionTitle}>MELDINGEN</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Nog geen meldingen.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, !item.is_read && styles.rowUnread, pressed && styles.rowPressed]}
              onPress={() => onPressNotification(item)}
            >
              {item.type === "moderation_update" ? (
                <View style={styles.iconWrap}>
                  <Ionicons name={iconForNotification(item.type)} size={22} color={colors.primaryDark} />
                </View>
              ) : (
                <Image
                  source={{ uri: item.otherUser?.photo_url ?? avatarPlaceholder(item.otherUser?.id ?? item.id) }}
                  style={styles.avatar}
                />
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.description, !item.is_read && styles.descriptionUnread]}>
                  {describeNotification(item)}
                </Text>
                <Text style={styles.timestamp}>{formatConversationTimestamp(item.created_at)}</Text>
              </View>
              {!item.is_read ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          )}
        />
      )}

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowUnread: {
    backgroundColor: colors.surface,
  },
  rowPressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBody: {
    flex: 1,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  descriptionUnread: {
    fontFamily: fonts.bodySemiBold,
  },
  timestamp: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
});
