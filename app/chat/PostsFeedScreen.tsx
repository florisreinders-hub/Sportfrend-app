import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { PostComposer } from "@/components/PostComposer";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchPosts, formatEventDateTime, toggleLike } from "@/lib/api";
import { avatarPlaceholder } from "@/constants/placeholders";

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
          renderItem={({ item }) => {
            const liked = item.post_likes?.some((l: any) => l.user_id === session?.user?.id);
            const likeCount = item.post_likes?.length ?? 0;
            const when = formatEventDateTime(item.event_date);
            return (
              <View style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image
                    source={{ uri: item.author?.avatar_url ?? avatarPlaceholder(item.author_id) }}
                    style={styles.avatar}
                  />
                  <Text style={styles.postAuthor}>{item.author?.full_name ?? "Sportmaatje"}</Text>
                </View>
                <Text style={styles.postBody}>{item.body}</Text>
                {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.postImage} /> : null}
                {item.sport || when ? (
                  <View style={styles.meta}>
                    {item.sport ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="basketball-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.metaText}>{item.sport}</Text>
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
                <View style={styles.postActions}>
                  <Pressable onPress={() => onLike(item)} hitSlop={8} style={styles.likeButton}>
                    <Ionicons
                      name={liked ? "thumbs-up" : "thumbs-up-outline"}
                      size={20}
                      color={liked ? colors.primary : colors.black}
                    />
                    {likeCount > 0 ? <Text style={styles.likeCount}>{likeCount}</Text> : null}
                  </Pressable>
                </View>
              </View>
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
  postCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
    fontFamily: fonts.accent,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  postBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  postImage: {
    width: "100%",
    height: 180,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  postActions: {
    flexDirection: "row",
    gap: spacing.md,
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
  },
  likeCount: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
});
