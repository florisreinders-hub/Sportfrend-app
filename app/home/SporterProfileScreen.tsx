import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import {
  blockUser,
  calculateAge,
  deleteMatch,
  findMatchBetween,
  fetchPostsByAuthor,
  formatEventDateTime,
  getDataErrorMessage,
  toggleLike,
  Profile,
} from "@/lib/api";
import { avatarPlaceholder, sportPhotoPlaceholder } from "@/constants/placeholders";
import { ReportModal } from "@/components/ReportModal";

const logoMark = require("@/assets/logo-mark.png");

type Props = NativeStackScreenProps<RootStackParamList, "SporterProfile">;

export default function SporterProfileScreen({ route, navigation }: Props) {
  const { sporterId } = route.params;
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);

      (async () => {
        try {
          const [{ data: profileData, error: profileError }, postsData] = await Promise.all([
            supabase.from("profiles").select("*").eq("id", sporterId).maybeSingle(),
            fetchPostsByAuthor(sporterId),
          ]);
          if (profileError) throw profileError;
          if (cancelled) return;
          setProfile(profileData as Profile | null);
          setPosts(postsData);

          if (session?.user) {
            const existingMatchId = await findMatchBetween(session.user.id, sporterId);
            if (!cancelled) setMatchId(existingMatchId);
          }
        } catch (e) {
          if (!cancelled) setError(getDataErrorMessage(e));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [sporterId, session?.user])
  );

  const onRemoveFriend = () => {
    if (!matchId) return;
    Alert.alert("Vriend verwijderen", `Weet je zeker dat je ${profile?.full_name ?? "deze sporter"} wilt verwijderen?`, [
      { text: "Annuleren", style: "cancel" },
      {
        text: "Verwijderen",
        style: "destructive",
        onPress: async () => {
          setRemoving(true);
          try {
            await deleteMatch(matchId);
            navigation.goBack();
          } catch (e) {
            Alert.alert("Mislukt", getDataErrorMessage(e));
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  const onBlock = () => {
    if (!session?.user) return;
    Alert.alert(
      "Gebruiker blokkeren",
      `Weet je zeker dat je ${profile?.full_name ?? "deze sporter"} wilt blokkeren? Jullie zien elkaar dan niet meer in Ontdekken en kunnen niet meer met elkaar chatten.`,
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Blokkeren",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUser(session.user.id, sporterId);
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
    Alert.alert(profile?.full_name ?? "Sportmaatje", undefined, [
      { text: "Rapporteren", onPress: () => setReportVisible(true) },
      { text: "Blokkeren", style: "destructive", onPress: onBlock },
      { text: "Annuleren", style: "cancel" },
    ]);
  };

  const onToggleLike = async (post: any) => {
    if (!session?.user) return;
    const liked = post.post_likes?.some((l: any) => l.user_id === session.user.id);
    try {
      await toggleLike(post.id, session.user.id, liked);
      setPosts((prev) =>
        prev.map((p) =>
          p.id !== post.id
            ? p
            : {
                ...p,
                post_likes: liked
                  ? p.post_likes.filter((l: any) => l.user_id !== session.user.id)
                  : [...(p.post_likes ?? []), { user_id: session.user.id }],
              }
        )
      );
    } catch (e) {
      Alert.alert("Mislukt", getDataErrorMessage(e));
    }
  };

  const age = calculateAge(profile?.birthdate);

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Image source={logoMark} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>SPORTFREND</Text>
        <View style={{ flex: 1 }} />
        {matchId ? (
          <Pressable style={styles.removeButton} onPress={onRemoveFriend} disabled={removing}>
            <Text style={styles.removeButtonLabel}>{removing ? "Bezig..." : "Vriend verwijderen"}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onOpenMenu} hitSlop={8} style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.black} />
        </Pressable>
      </View>

      {session?.user ? (
        <ReportModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          reporterId={session.user.id}
          reportedId={sporterId}
          reportedName={profile?.full_name ?? "deze sporter"}
        />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Image
              source={{ uri: profile?.photo_url ?? sportPhotoPlaceholder(sporterId) }}
              style={styles.photo}
            />
            <View>
              <Text style={styles.name}>{profile?.full_name ?? "Sportmaatje"}</Text>
              {age != null ? <Text style={styles.age}>Leeftijd {age}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <Text style={styles.detailLine}>Sport: {profile?.sport ?? "-"}</Text>
          <Text style={styles.detailLine}>Niveau: {profile?.level ?? "-"}</Text>
          <Text style={styles.detailLine}>Locatie: {profile?.city ?? "-"}</Text>
          {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <Text style={styles.sectionTitle}>BERICHTEN</Text>
          {posts.length === 0 ? (
            <Text style={styles.emptyPosts}>Nog geen berichten geplaatst.</Text>
          ) : (
            posts.map((post) => {
              const liked = post.post_likes?.some((l: any) => l.user_id === session?.user?.id);
              const likeCount = post.post_likes?.length ?? 0;
              const when = formatEventDateTime(post.event_date);
              return (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Image
                      source={{ uri: post.author?.avatar_url ?? avatarPlaceholder(sporterId) }}
                      style={styles.avatar}
                    />
                    <Text style={styles.postAuthor}>{profile?.full_name ?? "Sportmaatje"}</Text>
                  </View>
                  <Text style={styles.postBody}>{post.body}</Text>
                  {post.image_url ? <Image source={{ uri: post.image_url }} style={styles.postImage} /> : null}
                  {post.sport || when ? (
                    <View style={styles.meta}>
                      {post.sport ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="basketball-outline" size={14} color={colors.textSecondary} />
                          <Text style={styles.metaText}>{post.sport}</Text>
                        </View>
                      ) : null}
                      {when ? (
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                          <Text style={styles.metaText}>{when}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  <Pressable onPress={() => onToggleLike(post)} hitSlop={8} style={styles.likeButton}>
                    <Ionicons
                      name={liked ? "thumbs-up" : "thumbs-up-outline"}
                      size={20}
                      color={liked ? colors.primary : colors.black}
                    />
                    {likeCount > 0 ? <Text style={styles.metaText}>{likeCount}</Text> : null}
                  </Pressable>
                </View>
              );
            })
          )}
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
  menuButton: {
    marginLeft: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
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
  bio: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  emptyPosts: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
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
  postImage: {
    width: "100%",
    height: 180,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
});
