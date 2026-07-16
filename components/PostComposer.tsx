import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { avatarPlaceholder } from "@/constants/placeholders";
import { formatEventDateTime } from "@/lib/api";
import { DatePickerModal } from "./DatePickerModal";

type Props = {
  style?: ViewStyle;
};

/**
 * Entry point into "Bericht plaatsen" (NewPostScreen) - the same bar shown
 * on both the Berichten feed and the Home/Connecties tab, so it looks and
 * behaves identically wherever it appears.
 *
 * The calendar icon opens a native date picker (see DatePickerModal) so the
 * event date can be picked here instead of typed by hand. The picked date
 * is shown in the bar and carried into NewPostScreen as a param, which
 * initializes that screen's own date picker to the same value - so it's
 * the same ISO date either way, whether picked here or on the next screen.
 */
export function PostComposer({ style }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [eventDate, setEventDate] = useState<string | null>(null);

  const dateLabel = eventDate ? formatEventDateTime(eventDate) : null;

  return (
    <Pressable
      style={[styles.composer, style]}
      onPress={() => navigation.navigate("NewPost", { eventDate: eventDate ?? undefined })}
    >
      <Image source={{ uri: avatarPlaceholder(session?.user?.id ?? "me") }} style={styles.composerAvatar} />
      <View style={styles.composerBody}>
        <Text style={styles.composerPlaceholder}>Bericht plaatsen</Text>
        <View style={styles.composerIcons}>
          <Ionicons name="camera-outline" size={18} color={colors.textSecondary} />
          <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
          <Pressable onPress={() => setPickerVisible(true)} hitSlop={8}>
            <Ionicons name="calendar-outline" size={18} color={eventDate ? colors.primaryDark : colors.textSecondary} />
          </Pressable>
        </View>
        {dateLabel ? (
          <Pressable style={styles.dateChip} onPress={() => setEventDate(null)} hitSlop={8}>
            <Text style={styles.dateChipText}>{dateLabel}</Text>
            <Ionicons name="close" size={12} color={colors.primaryDark} />
          </Pressable>
        ) : null}
      </View>
      <Ionicons name="send-outline" size={22} color={colors.black} />

      <DatePickerModal
        visible={pickerVisible}
        value={eventDate}
        onChange={setEventDate}
        onClose={() => setPickerVisible(false)}
        minimumDate={new Date()}
      />
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
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  dateChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
});
