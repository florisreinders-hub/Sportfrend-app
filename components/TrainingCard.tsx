import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, radii, shadows, spacing } from "@/constants/theme";
import { Training } from "@/lib/api";

const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const WEEKDAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];

/** "wo 18 jul, 14:30" for a training's date ("YYYY-MM-DD") + time ("HH:MM:SS" or "HH:MM"). */
export function formatTrainingWhen(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const hhmm = time.slice(0, 5);
  if (!year || !month || !day) return hhmm;
  const weekday = WEEKDAYS_NL[new Date(year, month - 1, day).getDay()];
  return `${weekday} ${day} ${MONTHS_NL[month - 1]}, ${hhmm}`;
}

type Props = {
  training: Training;
  viewerId: string;
  otherName: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onChangeProposal?: () => void;
  busy?: boolean;
};

/**
 * Special chat-bubble-sized card for a training proposal - deliberately
 * not rendered as a message bubble (ChatDetailScreen merges `messages` and
 * `trainings` into one sorted list and switches on item kind), since a
 * training needs status + actions a plain text bubble can't hold.
 */
export function TrainingCard({ training, viewerId, otherName, onAccept, onDecline, onChangeProposal, busy }: Props) {
  const isMine = training.created_by === viewerId;
  const isPending = training.status === "pending";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={18} color={colors.primaryDark} />
        <Text style={styles.title}>Trainingsvoorstel</Text>
      </View>

      <Text style={styles.when}>{formatTrainingWhen(training.date, training.time)}</Text>
      {training.sport ? <Text style={styles.detail}>{training.sport}</Text> : null}
      {training.location ? (
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.detail}>{training.location}</Text>
        </View>
      ) : null}
      {training.note ? <Text style={styles.note}>{training.note}</Text> : null}

      {isPending ? (
        isMine ? (
          <Text style={styles.status}>Wacht op reactie van {otherName}</Text>
        ) : (
          <View style={styles.actions}>
            {busy ? (
              <ActivityIndicator color={colors.primaryDark} />
            ) : (
              <>
                <View style={styles.actionRow}>
                  <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={onAccept}>
                    <Text style={styles.acceptButtonText}>Accepteren</Text>
                  </Pressable>
                  <Pressable style={[styles.actionButton, styles.changeButton]} onPress={onChangeProposal}>
                    <Text style={styles.changeButtonText}>Voorstel wijzigen</Text>
                  </Pressable>
                </View>
                <Pressable onPress={onDecline} hitSlop={8}>
                  <Text style={styles.declineText}>Afwijzen</Text>
                </Pressable>
              </>
            )}
          </View>
        )
      ) : training.status === "accepted" ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primaryDark} />
          <Text style={[styles.status, styles.statusAccepted]}>Geaccepteerd</Text>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <Ionicons name="close-circle" size={16} color={colors.danger} />
          <Text style={[styles.status, styles.statusDeclined]}>Afgewezen</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.xs,
    gap: 4,
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
  when: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  detail: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 2,
  },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  statusAccepted: {
    color: colors.primaryDark,
  },
  statusDeclined: {
    color: colors.danger,
  },
  actions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  acceptButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  changeButton: {
    backgroundColor: "transparent",
    borderColor: colors.border,
  },
  changeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  declineText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
