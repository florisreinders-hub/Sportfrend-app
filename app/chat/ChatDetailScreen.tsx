import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { fetchMessages, getDataErrorMessage, Message, sendMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

export default function ChatDetailScreen({ route, navigation }: Props) {
  const { chatId, name, photo } = route.params;
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await fetchMessages(chatId));
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();

    // Realtime: any message another participant inserts into this match
    // shows up immediately, no refresh needed. Our own sends are appended
    // locally in onSend instead of waiting for this event to round-trip.
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${chatId}` },
        (payload) => {
          const inserted = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, load]);

  const onSend = async () => {
    if (!draft.trim() || !session?.user || sending) return;
    const body = draft.trim();
    setDraft("");
    setSending(true);
    try {
      const inserted = await sendMessage(chatId, session.user.id, body);
      setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
    } catch (e) {
      setDraft(body);
      Alert.alert("Versturen mislukt", getDataErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Image source={{ uri: photo }} style={styles.avatar} />
        <Text style={styles.name}>{name}</Text>
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMine = item.sender_id === session?.user?.id;
              return (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={styles.bubbleText}>{item.body}</Text>
                  <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {new Date(item.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Stuur het eerste bericht!</Text>}
          />
        )}

        <View style={styles.inputRow}>
          <Input
            placeholder="Typ een bericht"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={onSend}
            returnKeyType="send"
            style={styles.input}
          />
          <Pressable
            onPress={onSend}
            hitSlop={8}
            disabled={!draft.trim() || sending}
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
          >
            <Ionicons name="send" size={22} color={colors.black} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  name: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  messages: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  bubble: {
    maxWidth: "75%",
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleTheirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
  },
  bubbleText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  bubbleTime: {
    fontFamily: fonts.body,
    fontSize: 10,
    marginTop: 2,
  },
  bubbleTimeMine: {
    color: colors.black,
    opacity: 0.6,
    textAlign: "right",
  },
  bubbleTimeTheirs: {
    color: colors.textSecondary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    marginBottom: spacing.md,
  },
  sendButton: {
    marginBottom: spacing.md,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
