import React from "react";
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

export type SelectOption = { label: string; value: string | null };

type Props = {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  onClose: () => void;
};

/** Scrollable modal picker, used for fields with too many options for a tap-to-cycle pill. */
export function SelectModal({ visible, title, options, selectedValue, onSelect, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // RN's Modal spans the full window on Android too, so it's subject to
  // the same edge-to-edge system-nav-bar overlap as the rest of the app
  // (Android only since Expo SDK 54 - see BottomNav.tsx/ChatDetailScreen.tsx
  // for the same root cause). iOS already looks right here and must stay
  // unchanged.
  const androidBottomInset = Platform.OS === "android" ? insets.bottom : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: spacing.lg + androidBottomInset }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={26} color={colors.danger} />
            </Pressable>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value ?? "__none__"}
            style={styles.list}
            showsVerticalScrollIndicator
            renderItem={({ item }) => {
              const isSelected = item.value === selectedValue;
              return (
                <Pressable
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{item.label}</Text>
                  {isSelected ? <Ionicons name="checkmark" size={20} color={colors.black} /> : null}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = 420;

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
    maxHeight: SHEET_MAX_HEIGHT,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0,
  },
  optionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  optionTextSelected: {
    fontFamily: fonts.bodySemiBold,
  },
});
