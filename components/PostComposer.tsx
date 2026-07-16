import React from "react";
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { avatarPlaceholder } from "@/constants/placeholders";

type Props = {
  style?: ViewStyle;
};

/**
 * Entry point into "Bericht plaatsen" (NewPostScreen) - the same bar shown
 * on both the Berichten feed and the Home/Connecties tab, so it looks and
 * behaves identically wherever it appears.
 */
export function PostComposer({ style }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();

  return (
    <Pressable style={[styles.composer, style]} onPress={() => navigation.navigate("NewPost")}>
      <Image source={{ uri: avatarPlaceholder(session?.user?.id ?? "me") }} style={styles.composerAvatar} />
      <View style={styles.composerBody}>
        <Text style={styles.composerPlaceholder}>Bericht plaatsen</Text>
        <View style={styles.composerIcons}>
          <Ionicons name="camera-outline" size={18} color={colors.textSecondary} />
          <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
          <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
        </View>
      </View>
      <Ionicons name="send-outline" size={22} color={colors.black} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  composerBody: {
    flex: 1,
  },
  composerPlaceholder: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  composerIcons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
