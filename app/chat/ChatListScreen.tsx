import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Conversation, fetchConversations, formatConversationTimestamp, getDataErrorMessage } from "@/lib/api";
import { avatarPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "ChatList">;

export default function ChatListScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConversations(userId);
      setConversations(data);
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

  // Live-refresh the list (last message + ordering) whenever a new message
  // arrives on any of this user's conversations, so a reply doesn't require
  // leaving and reopening this screen to show up.
  useEffect(() => {
    if (!userId || conversations.length === 0) return;

    const matchIds = conversations.map((c) => c.id);
    const channel = supabase
      .channel(`chat-list-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=in.(${matchIds.join(",")})` },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Re-subscribe when the set of conversation ids changes (e.g. a new match).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversations.map((c) => c.id).join(",")]);

  const openConversation = (conversation: Conversation) => {
    navigation.navigate("ChatDetail", {
      chatId: conversation.id,
      name: conversation.otherUser?.full_name ?? "Sportmaatje",
      photo: conversation.otherUser?.photo_url ?? avatarPlaceholder(conversation.otherUser?.id ?? conversation.id),
      otherUserId: conversation.otherUser?.id ?? conversation.id,
    });
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.sectionTitle}>GESPREKKEN</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Nog geen gesprekken. Connect met een sportmaatje om te beginnen met chatten!
            </Text>
          }
          renderItem={({ item }) => {
            const name = item.otherUser?.full_name ?? "Sportmaatje";
            const photo = item.otherUser?.photo_url ?? avatarPlaceholder(item.otherUser?.id ?? item.id);
            const preview = item.lastMessage
              ? item.lastMessage.body || (item.lastMessage.image_url ? "📷 Foto" : "")
              : "Stuur het eerste bericht!";
            const timestamp = formatConversationTimestamp(item.lastMessage?.created_at ?? item.created_at);
            const isMine = item.lastMessage?.sender_id === session?.user?.id;
            return (
              <Pressable style={styles.row} onPress={() => openConversation(item)}>
                <Image source={{ uri: photo }} style={styles.avatar} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {isMine ? `Jij: ${preview}` : preview}
                  </Text>
                </View>
                <Text style={styles.timestamp}>{timestamp}</Text>
              </Pressable>
            );
          }}
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  rowBody: {
    flex: 1,
  },
  name: {
    fontFamily: fonts.accent,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  preview: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timestamp: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
});
