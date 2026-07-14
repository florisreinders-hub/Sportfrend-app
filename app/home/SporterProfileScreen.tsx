import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/api";
import { avatarPlaceholder, sportPhotoPlaceholder } from "@/constants/placeholders";

const logoMark = require("@/assets/logo-mark.png");

type Props = NativeStackScreenProps<RootStackParamList, "SporterProfile">;

export default function SporterProfileScreen({ route, navigation }: Props) {
  const { sporterId } = route.params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", sporterId)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [sporterId]);

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Image source={logoMark} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>SPORTFREND</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.removeButton}>
          <Text style={styles.removeButtonLabel}>Vriend verwijderen</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Image
              source={{ uri: profile?.photo_url ?? sportPhotoPlaceholder(sporterId) }}
              style={styles.photo}
            />
            <View>
              <Text style={styles.name}>{profile?.full_name ?? "Sportmaatje"}</Text>
              {profile?.birthdate ? <Text style={styles.age}>Leeftijd {profile.birthdate}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <Text style={styles.detailLine}>Sport: {profile?.sport ?? "-"}</Text>
          <Text style={styles.detailLine}>Niveau: {profile?.level ?? "-"}</Text>
          <Text style={styles.detailLine}>Locatie: {profile?.city ?? "-"}</Text>

          <Text style={styles.sectionTitle}>BERICHTEN</Text>
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Image source={{ uri: avatarPlaceholder(sporterId) }} style={styles.avatar} />
              <Text style={styles.postAuthor}>{profile?.full_name ?? "Sportmaatje"}</Text>
            </View>
            <Text style={styles.postBody}>Nog geen berichten geplaatst.</Text>
            <Ionicons name="thumbs-up-outline" size={20} color={colors.black} style={{ marginTop: spacing.xs }} />
          </View>
        </ScrollView>
      )}

      <BottomNav active="home" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  logo: {
    width: 19,
    height: 22,
  },
  removeButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  removeButtonLabel: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.black,
  },
  content: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  photo: {
    width: 87,
    height: 100,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  name: {
    fontFamily: fonts.accent,
    fontSize: 28,
    color: colors.black,
  },
  age: {
    fontFamily: fonts.accent,
    fontSize: fontSizes.lg,
    color: colors.black,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  detailLine: {
    fontFamily: fonts.accent,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  postAuthor: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  postBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
});
