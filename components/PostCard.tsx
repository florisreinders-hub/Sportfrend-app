import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { formatEventDateTime } from "@/lib/api";
import { avatarPlaceholder } from "@/constants/placeholders";

type Props = {
  post: any;
  currentUserId?: string;
  onToggleLike: (post: any) => void;
};

/** A single "Bericht plaatsen" post - author, body, photo, sport/datum, like button. Shared by every screen that lists posts. */
export function PostCard({ post, currentUserId, onToggleLike }: Props) {
  const liked = post.post_likes?.some((l: any) => l.user_id === currentUserId);
  const likeCount = post.post_likes?.length ?? 0;
  const when = formatEventDateTime(post.event_date);

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image source={{ uri: post.author?.avatar_url ?? avatarPlaceholder(post.author_id) }} style={styles.avatar} />
        <Text style={styles.postAuthor}>{post.author?.full_name ?? "Sportmaatje"}</Text>
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
      <View style={styles.postActions}>
        <Pressable onPress={() => onToggleLike(post)} hitSlop={8} style={styles.likeButton}>
          <Ionicons name={liked ? "thumbs-up" : "thumbs-up-outline"} size={20} color={liked ? colors.primary : colors.black} />
          {likeCount > 0 ? <Text style={styles.likeCount}>{likeCount}</Text> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
