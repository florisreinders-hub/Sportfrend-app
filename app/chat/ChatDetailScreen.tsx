import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  blockUser,
  createTraining,
  fetchDiscoverDailyStatus,
  fetchMessages,
  fetchSharedSport,
  fetchTrainings,
  getDataErrorMessage,
  Message,
  respondToTraining,
  sendMessage,
  Training,
  TrainingProposalFields,
  updateTrainingProposal,
  uploadChatImage,
} from "@/lib/api";
import { checkContentFilter, showContentFilterBlockedAlert } from "@/lib/contentFilter";
import { ReportModal } from "@/components/ReportModal";
import { TrainingCard } from "@/components/TrainingCard";
import { TrainingFormModal } from "@/components/TrainingFormModal";

type Props = NativeStackScreenProps<RootStackParamList, "ChatDetail">;

type ChatItem = { kind: "message"; data: Message } | { kind: "training"; data: Training };

export default function ChatDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  // ScreenContainer only reserves the top/left/right safe area here
  // (edges prop below), not bottom - Android is edge-to-edge since Expo
  // SDK 54, so without this the input row sits flush against (and partly
  // behind) the system nav bar whenever the keyboard is closed. The
  // Platform check matters: insets.bottom is also non-zero on iOS (the
  // home indicator), but iOS's appearance here already works and must
  // stay unchanged, so this is Android-only on purpose, not a no-op guard.
  const androidBottomInset = Platform.OS === "android" ? insets.bottom : 0;
  const { chatId, name, photo, otherUserId } = route.params;
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  // "Trainings & Buddy Planner" (Premium+Elite, requirement: "Plan een
  // training" is alleen zichtbaar/bruikbaar voor Premium/Elite-gebruikers).
  // null until refreshPlan() resolves - deliberately NOT treated as
  // "locked" in the meantime (see onOpenTrainingForm below), same
  // fail-open reasoning as FilterScreen.tsx's plan-gated filters:
  // discover_profiles()-style server-side enforcement (here: the
  // "Premium match participants can propose trainings" RLS policy) is
  // the real gate regardless of whether this status call ever succeeds.
  const [plan, setPlan] = useState<"basis" | "premium" | "elite" | null>(null);
  const [defaultSport, setDefaultSport] = useState<string | null>(null);
  const [trainingFormVisible, setTrainingFormVisible] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [respondingTrainingId, setRespondingTrainingId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [msgs, trns] = await Promise.all([fetchMessages(chatId), fetchTrainings(chatId)]);
      setMessages(msgs);
      setTrainings(trns);
    } catch {
      setMessages([]);
      setTrainings([]);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Reuses the same discover_daily_status() RPC as HomeScreen/FilterScreen
  // purely for its `plan` field - no new RPC needed, same as how
  // FilterScreen already piggybacks on it for its own plan-gated filters.
  const refreshPlan = useCallback(async () => {
    try {
      const status = await fetchDiscoverDailyStatus();
      setPlan(status.plan);
    } catch (e) {
      console.warn("[ChatDetailScreen] Kon abonnementsstatus niet ophalen:", e);
    }
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchSharedSport(session.user.id, otherUserId)
      .then(setDefaultSport)
      .catch((e) => console.warn("[ChatDetailScreen] Kon gedeelde sport niet ophalen:", e));
  }, [session?.user, otherUserId]);

  useEffect(() => {
    load();
    refreshPlan();

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

    // Same idea for trainings - a new proposal, an accept/decline, or a
    // "voorstel wijzigen" edit (all of which are INSERT/UPDATE, never
    // DELETE - there's no delete policy on trainings) needs to reach
    // *both* participants live, not just the one who triggered it.
    const trainingsChannel = supabase
      .channel(`trainings-${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trainings", filter: `match_id=eq.${chatId}` },
        (payload) => {
          const inserted = payload.new as Training;
          setTrainings((prev) => (prev.some((t) => t.id === inserted.id) ? prev : [...prev, inserted]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trainings", filter: `match_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as Training;
          setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(trainingsChannel);
    };
  }, [chatId, load, refreshPlan]);

  const chatItems = useMemo<ChatItem[]>(() => {
    const items: ChatItem[] = [
      ...messages.map((m) => ({ kind: "message" as const, data: m })),
      ...trainings.map((t) => ({ kind: "training" as const, data: t })),
    ];
    return items.sort((a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime());
  }, [messages, trainings]);

  const onOpenTrainingForm = () => {
    // Fail-open on an unresolved/failed plan fetch (plan === null) - same
    // reasoning as the comment on the `plan` state above. A genuinely
    // Basis account that slips past this still gets rejected by the
    // "Premium match participants can propose trainings" RLS policy on
    // submit, surfaced via the Alert in onSubmitTrainingForm below.
    if (plan !== null && plan !== "premium" && plan !== "elite") {
      navigation.navigate("Pricing");
      return;
    }
    setEditingTraining(null);
    setTrainingFormVisible(true);
  };

  const onOpenChangeProposal = (training: Training) => {
    setEditingTraining(training);
    setTrainingFormVisible(true);
  };

  const onSubmitTrainingForm = async (fields: TrainingProposalFields) => {
    if (!session?.user) return;
    try {
      if (editingTraining) {
        const updated = await updateTrainingProposal(editingTraining.id, session.user.id, fields);
        setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createTraining(chatId, session.user.id, fields);
        setTrainings((prev) => (prev.some((t) => t.id === created.id) ? prev : [...prev, created]));
      }
    } catch (e) {
      Alert.alert("Versturen mislukt", getDataErrorMessage(e));
      throw e;
    }
  };

  const onRespondTraining = async (training: Training, status: "accepted" | "declined") => {
    setRespondingTrainingId(training.id);
    try {
      const updated = await respondToTraining(training.id, status);
      setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e) {
      Alert.alert("Reageren mislukt", getDataErrorMessage(e));
    } finally {
      setRespondingTrainingId(null);
    }
  };

  const onSend = async () => {
    if (!draft.trim() || !session?.user || sending) return;
    const body = draft.trim();
    const flagged = await checkContentFilter(body);
    if (flagged.length > 0) {
      showContentFilterBlockedAlert("bericht", "verstuurd");
      return;
    }
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

  const onPickImage = async () => {
    if (!session?.user || uploadingImage || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;

    if (draft.trim()) {
      const flagged = await checkContentFilter(draft);
      if (flagged.length > 0) {
        showContentFilterBlockedAlert("bericht", "verstuurd");
        return;
      }
    }

    setUploadingImage(true);
    try {
      const imageUrl = await uploadChatImage(chatId, session.user.id, result.assets[0].uri);
      const inserted = await sendMessage(chatId, session.user.id, draft.trim(), imageUrl);
      setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
      setDraft("");
    } catch (e) {
      Alert.alert("Versturen mislukt", getDataErrorMessage(e));
    } finally {
      setUploadingImage(false);
    }
  };

  const onBlock = () => {
    if (!session?.user) return;
    Alert.alert(
      "Gebruiker blokkeren",
      `Weet je zeker dat je ${name} wilt blokkeren? Jullie zien elkaar dan niet meer in Ontdekken en kunnen niet meer met elkaar chatten.`,
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Blokkeren",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(session.user.id, otherUserId);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Mislukt", getDataErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  const onOpenMenu = () => {
    Alert.alert(name, undefined, [
      { text: "Rapporteren", onPress: () => setReportVisible(true) },
      { text: "Blokkeren", style: "destructive", onPress: onBlock },
      { text: "Annuleren", style: "cancel" },
    ]);
  };

  return (
    <ScreenContainer withBottomPadding={false} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.profileLink, pressed && styles.profileLinkPressed]}
          onPress={() => navigation.navigate("SporterProfile", { sporterId: otherUserId })}
          hitSlop={4}
        >
          <Image source={{ uri: photo }} style={styles.avatar} />
          <Text style={styles.name}>{name}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onOpenMenu} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.black} />
        </Pressable>
      </View>
      <View style={styles.divider} />

      {session?.user ? (
        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          reporterId={session.user.id}
          reportedId={otherUserId}
          reportedName={name}
          matchId={chatId}
        />
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={80}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <FlatList
            ref={listRef}
            data={chatItems}
            keyExtractor={(item) => `${item.kind}-${item.data.id}`}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              if (item.kind === "training") {
                return (
                  <TrainingCard
                    training={item.data}
                    viewerId={session?.user?.id ?? ""}
                    otherName={name}
                    busy={respondingTrainingId === item.data.id}
                    onAccept={() => onRespondTraining(item.data, "accepted")}
                    onDecline={() => onRespondTraining(item.data, "declined")}
                    onChangeProposal={() => onOpenChangeProposal(item.data)}
                  />
                );
              }
              const message = item.data;
              const isMine = message.sender_id === session?.user?.id;
              return (
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {message.image_url ? (
                    <Image source={{ uri: message.image_url }} style={styles.bubbleImage} resizeMode="cover" />
                  ) : null}
                  {message.body ? <Text style={styles.bubbleText}>{message.body}</Text> : null}
                  <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {new Date(message.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>Stuur het eerste bericht!</Text>}
          />
        )}

        <View style={[styles.inputRow, { paddingBottom: spacing.md + androidBottomInset }]}>
          <Pressable
            onPress={onPickImage}
            hitSlop={8}
            disabled={uploadingImage || sending}
            style={[styles.imageButton, (uploadingImage || sending) && styles.sendButtonDisabled]}
          >
            {uploadingImage ? (
              <ActivityIndicator color={colors.black} size="small" />
            ) : (
              <Ionicons name="image-outline" size={22} color={colors.black} />
            )}
          </Pressable>
          {/*
            "Plan een training" - Premium+Elite (requirement 2). Locked for
            Basis: a plain lock icon here, tapping it goes straight to
            Pricing rather than opening a form that would just get
            rejected server-side - see onOpenTrainingForm.
          */}
          <Pressable onPress={onOpenTrainingForm} hitSlop={8} style={styles.trainingButton}>
            <Ionicons
              name={plan === "premium" || plan === "elite" ? "calendar-outline" : "lock-closed-outline"}
              size={22}
              color={colors.black}
            />
          </Pressable>
          <Input
            placeholder="Typ een bericht"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={onSend}
            returnKeyType="send"
            containerStyle={styles.inputContainer}
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

      <TrainingFormModal
        visible={trainingFormVisible}
        title={editingTraining ? "Voorstel wijzigen" : "Plan een training"}
        submitLabel={editingTraining ? "Voorstel bijwerken" : "Versturen"}
        initialValues={
          editingTraining
            ? {
                date: editingTraining.date,
                time: editingTraining.time.slice(0, 5),
                sport: editingTraining.sport,
                location: editingTraining.location,
                note: editingTraining.note,
              }
            : { sport: defaultSport }
        }
        onSubmit={onSubmitTrainingForm}
        onClose={() => setTrainingFormVisible(false)}
      />
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
  profileLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  profileLinkPressed: {
    opacity: 0.6,
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
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.border,
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
  inputContainer: {
    flex: 1,
    marginBottom: 0,
  },
  imageButton: {
    width: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  trainingButton: {
    width: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
