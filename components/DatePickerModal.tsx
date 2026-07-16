import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Props = {
  visible: boolean;
  /** ISO "YYYY-MM-DD", or null for no selection yet. */
  value: string | null;
  onChange: (value: string) => void;
  onClose: () => void;
  minimumDate?: Date;
};

/** Date -> ISO "YYYY-MM-DD" in local time (avoids the UTC-shift toISOString() would introduce). */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Native date picker (@react-native-community/datetimepicker - bundled
 * into Expo Go, unlike most native modules), shared by every screen that
 * lets someone pick an event date. Picking from a calendar instead of
 * typing a string means there's no format to get wrong and no invalid
 * date to reject - the two platforms need different chrome around it:
 * Android's picker is a self-dismissing native dialog, iOS's inline/
 * spinner picker doesn't self-dismiss so it's wrapped in a bottom-sheet
 * Modal with an explicit "Klaar" button.
 */
export function DatePickerModal({ visible, value, onChange, onClose, minimumDate }: Props) {
  const onChangeDate = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") onClose();
    if (event.type === "set" && date) onChange(toIsoDate(date));
  };

  if (!visible) return null;

  if (Platform.OS === "android") {
    return (
      <DateTimePicker
        value={value ? new Date(value) : new Date()}
        mode="date"
        display="default"
        minimumDate={minimumDate}
        onChange={onChangeDate}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Kies een datum</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetDone}>Klaar</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={value ? new Date(value) : new Date()}
            mode="date"
            display="spinner"
            minimumDate={minimumDate}
            onChange={onChangeDate}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
