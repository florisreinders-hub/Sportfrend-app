import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { createReport, getDataErrorMessage, REPORT_REASONS } from "@/lib/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  reporterId: string;
  reportedId: string;
  reportedName: string;
  matchId?: string;
};

/** "Rapporteren" sheet, opened from SporterProfileScreen and ChatDetailScreen. */
export function ReportModal({ visible, onClose, reporterId, reportedId, reportedName, matchId }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails("");
    setError(null);
    setDone(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReport(reporterId, reportedId, reason, details, matchId);
      setDone(true);
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{reportedName} rapporteren</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close-circle" size={26} color={colors.danger} />
            </Pressable>
          </View>

          {done ? (
            <View style={styles.content}>
              <Text style={styles.doneText}>
                Bedankt, je melding is verstuurd. Ons team bekijkt deze zo snel mogelijk.
              </Text>
              <Button label="Sluiten" onPress={handleClose} style={{ marginTop: spacing.md }} />
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={styles.label}>Reden</Text>
              {REPORT_REASONS.map((option) => {
                const isSelected = option.key === reason;
                return (
                  <Pressable
                    key={option.key}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => setReason(option.key)}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={20} color={colors.black} /> : null}
                  </Pressable>
                );
              })}

              <Input
                label="Toelichting (optioneel)"
                placeholder="Vertel wat er is gebeurd"
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={3}
                style={styles.detailsInput}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                label="Rapporteren"
                variant="danger"
                onPress={onSubmit}
                disabled={!reason}
                loading={submitting}
              />
            </View>
          )}
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
    fontSize: fontSizes.md,
    color: colors.black,
    flex: 1,
    marginRight: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  optionTextSelected: {
    fontFamily: fonts.bodySemiBold,
  },
  detailsInput: {
    height: 72,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  doneText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
  },
});
