import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Match">;

export default function MatchScreen({ route, navigation }: Props) {
  const { matchedName, matchedPhoto } = route.params;
  const [message, setMessage] = useState("");

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <View style={styles.photoWrap}>
        <Image source={{ uri: matchedPhoto }} style={styles.photo} />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>CONNECTIE!</Text>
          <Text style={styles.emoji}>🔥</Text>
        </View>
      </View>

      <View style={styles.messageRow}>
        <Input
          placeholder="Stuur een bericht"
          value={message}
          onChangeText={setMessage}
          style={styles.messageInput}
        />
        <Ionicons name="send" size={24} color={colors.black} style={styles.sendIcon} />
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
