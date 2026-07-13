import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/api";
import { avatarPlaceholder, sportPhotoPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session?.user) return;
      setLoading(true);
      supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          setProfile(data as Profile | null);
          setLoading(false);
        });
    }, [session?.user])
  );

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.editButton} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="settings-outline" size={16} color={colors.black} />
            <Text style={styles.editButtonLabel}>Profiel bewerken</Text>
          </Pressable>

          <View style={styles.headerRow}>
            <Image
              source={{ uri: profile?.photo_url ?? sportPhotoPlaceholder(session?.user?.id ?? "me") }}
              style={styles.photo}
            />
            <View>
              <Text style={styles.name}>{profile?.full_name ?? "Jouw naam"}</Text>
              {profile?.birthdate ? <Text style={styles.age}>Leeftijd {profile.birthdate}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <Text style={styles.detailLine}>Sport: {profile?.sport ?? "Nog niet ingesteld"}</Text>
          <Text style={styles.detailLine}>Niveau: {profile?.level ?? "-"}</Text>
          <Text style={styles.detailLine}>Locatie: {profile?.city ?? "-"}</Text>

          <Text style={styles.sectionTitle}>BERICHTEN</Text>
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Image
                source={{ uri: profile?.avatar_url ?? avatarPlaceholder(session?.user?.id ?? "me") }}
                style={styles.avatar}
              />
              <Text style={styles.postAuthor}>{profile?.full_name ?? "Jouw naam"}</Text>
            </View>
            <Text style={styles.postBody}>Nog geen berichten geplaatst.</Text>
            <Ionicons name="thumbs-up-outline" size={20} color={colors.black} style={{ marginTop: spacing.xs }} />
          </View>
        </ScrollView>
      )}

      <BottomNav active="profiel" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  editButton: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  editButtonLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.black,
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
