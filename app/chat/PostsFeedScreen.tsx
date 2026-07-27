import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchPosts, toggleLike } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "PostsFeed">;

export default function PostsFeedScreen(_props: Props) {
  const { session } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPosts();
      setPosts(data);
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

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      <PostComposer />

      <Text style={styles.sectionTitle}>BERICHTEN</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Nog geen berichten. Plaats de eerste!</Text>}
          renderItem={({ item }) => (
            <PostCard post={item} currentUserId={session?.user?.id} onToggleLike={onLike} />
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
});
