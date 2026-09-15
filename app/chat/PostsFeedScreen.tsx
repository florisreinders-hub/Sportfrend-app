import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { deletePost, fetchDiscoverDailyStatus, fetchPosts, getDataErrorMessage, toggleLike } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "PostsFeed">;

export default function PostsFeedScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Fail open (assume access) until proven otherwise - the "posts"/
  // "post_likes" RLS policies (0022_posts_premium_only.sql) are the real
  // boundary regardless of this; this only picks which UI to render.
  const [hasPostsAccess, setHasPostsAccess] = useState(true);

  // Same "prikbord is Premium/Elite-only" gate as HomeScreen's Connecties
  // tab (which shares this same public.posts table, so is subject to the
  // exact same RLS) - reuses fetchDiscoverDailyStatus() purely for its
  // `plan` field, same reasoning as there: no need for a second
  // near-identical RPC just to read the same account's plan.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = await fetchDiscoverDailyStatus().catch((e) => {
        console.warn("[PostsFeedScreen] Kon abonnement niet ophalen (prikbord-toegang):", e);
        return null;
      });
      const access = status ? status.plan === "premium" || status.plan === "elite" : true;
      setHasPostsAccess(access);
      if (access) {
        setPosts(await fetchPosts());
      } else {
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onLike = async (post: any) => {
    if (!session?.user) return;
    const liked = post.post_likes?.some((l: any) => l.user_id === session.user.id);
    await toggleLike(post.id, session.user.id, liked);
    load();
  };

  const onDelete = async (post: any) => {
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (e) {
      Alert.alert("Verwijderen mislukt", getDataErrorMessage(e));
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : !hasPostsAccess ? (
        <View style={styles.lockedCard}>
          <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
          <Text style={styles.lockedTitle}>Berichten is een Premium-functie</Text>
          <Text style={styles.lockedText}>Upgrade naar Premium om berichten te plaatsen en te bekijken.</Text>
          <Button
            label="Bekijk Premium"
            variant="primary"
            onPress={() => navigation.navigate("Pricing")}
            style={styles.lockedButton}
          />
        </View>
      ) : (
        <>
          <PostComposer />
          <Text style={styles.sectionTitle}>BERICHTEN</Text>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Nog geen berichten. Plaats de eerste!</Text>}
            renderItem={({ item }) => (
              <PostCard post={item} currentUserId={session?.user?.id} onToggleLike={onLike} onDelete={onDelete} />
            )}
          />
        </>
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
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xl,
  },
  lockedCard: {
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  lockedTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
  },
  lockedText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  lockedButton: {
    marginTop: spacing.xs,
    minWidth: 160,
  },
});
