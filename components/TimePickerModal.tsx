import React from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Props = {
  visible: boolean;
  /** "HH:MM" (24h), or null for no selection yet. */
  value: string | null;
  onChange: (value: string) => void;
  onClose: () => void;
};

/** Date -> "HH:MM" in local time. */
function toHhMm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toDate(value: string | null): Date {
  if (!value) return new Date();
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

/**
 * Native time picker, same shape as DatePickerModal - Android's picker is
 * a self-dismissing native dialog, iOS's inline wheel doesn't self-dismiss
 * so it's wrapped in a bottom-sheet Modal with an explicit "Klaar" button.
 * See DatePickerModal.tsx for why display="spinner" is avoided on iOS.
 */
export function TimePickerModal({ visible, value, onChange, onClose }: Props) {
  const onChangeTime = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") onClose();
    if (event.type === "set" && date) onChange(toHhMm(date));
  };

  if (!visible) return null;

  if (Platform.OS === "android") {
    return <DateTimePicker value={toDate(value)} mode="time" display="default" onChange={onChangeTime} is24Hour />;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Kies een tijd</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.sheetDone}>Klaar</Text>
            </Pressable>
          </View>
          <View style={styles.pickerWrapper}>
            {/*
              display="inline", not "spinner" - same reasoning as
              DatePickerModal.tsx: "spinner" renders with no opaque backing
              on iOS + the New Architecture inside a transparent Modal, so
              the wheel ends up invisible against whatever is behind this
              sheet. "inline" uses a different native view that doesn't
              have that problem, and still renders as a wheel for mode="time".
            */}
            <DateTimePicker
              value={toDate(value)}
              mode="time"
              display="inline"
              themeVariant="light"
              textColor={colors.black}
              accentColor={colors.primary}
              onChange={onChangeTime}
              style={styles.picker}
            />
          </View>
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
  pickerWrapper: {
    backgroundColor: colors.white,
    minHeight: 220,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  picker: {
    backgroundColor: colors.white,
    height: 200,
  },
});
