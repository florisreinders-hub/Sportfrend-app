import React, { useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { RootStackParamList } from "@/navigation/types";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { avatarPlaceholder } from "@/constants/placeholders";
import { formatEventDateTime } from "@/lib/api";

type Props = {
  style?: ViewStyle;
};

/** Date -> ISO "YYYY-MM-DD" in local time (avoids the UTC-shift toISOString() would introduce). */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Entry point into "Bericht plaatsen" (NewPostScreen) - the same bar shown
 * on both the Berichten feed and the Home/Connecties tab, so it looks and
 * behaves identically wherever it appears.
 *
 * The calendar icon opens a native date picker (@react-native-community/
 * datetimepicker - bundled into Expo Go, unlike most native modules) so the
 * event date can be picked here instead of typed by hand. The picked date
 * is shown in the bar and carried into NewPostScreen as a param, which
 * pre-fills the same manual "DD-MM-JJJJ" field the full compose form
 * already validates and saves - so it goes through that one code path
 * either way, whether picked here or typed on the next screen.
 */
export function PostComposer({ style }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useAuth();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [eventDate, setEventDate] = useState<string | null>(null);

  const onChangeDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setPickerVisible(false);
    if (event.type === "set" && date) {
      setEventDate(toIsoDate(date));
    }
  };

  const dateLabel = eventDate ? formatEventDateTime(eventDate, null) : null;

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

      {pickerVisible && Platform.OS === "android" ? (
        <DateTimePicker
          value={eventDate ? new Date(eventDate) : new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={onChangeDate}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
          <Pressable style={styles.backdrop} onPress={() => setPickerVisible(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Kies een datum</Text>
                <Pressable onPress={() => setPickerVisible(false)} hitSlop={8}>
                  <Text style={styles.sheetDone}>Klaar</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={eventDate ? new Date(eventDate) : new Date()}
                mode="date"
                display="spinner"
                minimumDate={new Date()}
                onChange={onChangeDate}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
  },
  sheetDone: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.primaryDark,
  },
});
