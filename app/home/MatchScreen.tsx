import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { getDataErrorMessage, sendMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Match">;

export default function MatchScreen({ route, navigation }: Props) {
  const { matchId, matchedName, matchedPhoto } = route.params;
  const { session } = useAuth();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bannerScale = useRef(new Animated.Value(0.4)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(bannerScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [bannerScale, bannerOpacity]);

  const onSend = async () => {
    const body = message.trim();
    if (!body || !session?.user) return;
    setError(null);
    setSending(true);
    try {
      await sendMessage(matchId, session.user.id, body);
      navigation.replace("ChatDetail", { chatId: matchId, name: matchedName, photo: matchedPhoto });
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <View style={styles.photoWrap}>
        <Image source={{ uri: matchedPhoto }} style={styles.photo} />
        <Animated.View
          style={[styles.banner, { opacity: bannerOpacity, transform: [{ scale: bannerScale }] }]}
        >
          <Text style={styles.bannerText}>CONNECTIE!</Text>
          <Text style={styles.emoji}>🔥</Text>
        </Animated.View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.messageRow}>
        <Input
          placeholder="Stuur een bericht"
          value={message}
          onChangeText={(text) => {
            setMessage(text);
            if (error) setError(null);
          }}
          onSubmitEditing={onSend}
          returnKeyType="send"
          editable={!sending}
          style={styles.messageInput}
        />
        <Ionicons
          name="send"
          size={24}
          color={sending || !message.trim() ? colors.textSecondary : colors.black}
          style={styles.sendIcon}
          onPress={onSend}
          hitSlop={8}
        />
      </View>

      <Button
        label="Verder zoeken"
        onPress={() => navigation.replace("Home", { tab: "ontdekken" })}
        style={styles.cta}
      />

      <BottomNav active="home" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  photoWrap: {
    flex: 1,
    marginHorizontal: spacing.md,
    borderRadius: radii.xl,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  banner: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bannerText: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.white,
    letterSpacing: -1,
  },
  emoji: {
    fontSize: 40,
    marginTop: spacing.xs,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  messageInput: {
    flex: 1,
    marginBottom: 0,
  },
  sendIcon: {
    marginBottom: spacing.md,
  },
  cta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});
