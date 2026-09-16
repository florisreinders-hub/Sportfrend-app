import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { SelectModal } from "@/components/SelectModal";
import { DatePickerModal } from "@/components/DatePickerModal";
import { TimePickerModal } from "@/components/TimePickerModal";
import { formatTrainingWhen } from "@/components/TrainingCard";
import { SPORT_OPTIONS } from "@/constants/sports";
import { TrainingProposalFields } from "@/lib/api";
import { checkContentFilter, confirmFlaggedContent } from "@/lib/contentFilter";

const TRAINING_SPORT_OPTIONS = SPORT_OPTIONS.filter((o) => o.value !== null);

type Props = {
  visible: boolean;
  title: string;
  submitLabel: string;
  initialValues?: Partial<TrainingProposalFields>;
  onSubmit: (fields: TrainingProposalFields) => Promise<void>;
  onClose: () => void;
};

/**
 * Shared form for both "Plan een training" (new proposal) and "Voorstel
 * wijzigen" (editing an existing one) - only the title/submitLabel/
 * initialValues differ between the two call sites in ChatDetailScreen.
 */
export function TrainingFormModal({ visible, title, submitLabel, initialValues, onSubmit, onClose }: Props) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Re-seeds from initialValues every time the modal opens (not just on
  // first mount) - both call sites reuse a single, always-mounted instance
  // of this component, so a plain useState default would only ever apply
  // once and then keep showing stale values on the second and later opens.
  useEffect(() => {
    if (!visible) return;
    setDate(initialValues?.date ?? null);
    setTime(initialValues?.time ?? null);
    setSport(initialValues?.sport ?? null);
    setLocation(initialValues?.location ?? "");
    setNote(initialValues?.note ?? "");
  }, [visible, initialValues]);

  const sportLabel = TRAINING_SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Kies een sport";
  const dateTimeLabel = date && time ? formatTrainingWhen(date, time) : null;

  const onSubmitPress = async () => {
    if (!date || !time) {
      Alert.alert("Kies een datum en tijd", "Selecteer wanneer jullie willen trainen.");
      return;
    }
    if (note.trim()) {
      const flagged = await checkContentFilter(note);
      if (flagged.length > 0) {
        const proceed = await confirmFlaggedContent("opmerking", "versturen");
        if (!proceed) return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit({ date, time, sport, location: location.trim() || null, note: note.trim() || null });
      onClose();
    } catch {
      // onSubmit's own caller shows the error alert (getDataErrorMessage) -
      // this just keeps the modal open so the user can retry without
      // re-typing everything.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={26} color={colors.danger} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Pressable style={styles.field} onPress={() => setDatePickerVisible(true)}>
              <Ionicons name="calendar-outline" size={20} color={colors.black} />
              <Text style={styles.fieldLabel}>{date ? date.split("-").reverse().join("-") : "Datum"}</Text>
            </Pressable>
            <Pressable style={styles.field} onPress={() => setTimePickerVisible(true)}>
              <Ionicons name="time-outline" size={20} color={colors.black} />
              <Text style={styles.fieldLabel}>{time ? time.slice(0, 5) : "Tijd"}</Text>
            </Pressable>
            {dateTimeLabel ? <Text style={styles.preview}>{dateTimeLabel}</Text> : null}

            <Pressable style={styles.field} onPress={() => setSportPickerVisible(true)}>
              <Ionicons name="basketball-outline" size={20} color={colors.black} />
              <Text style={styles.fieldLabel}>{sportLabel}</Text>
            </Pressable>

            <Input
              label="Locatie (optioneel)"
              placeholder="Bijv. Sportpark De Toekomst"
              value={location}
              onChangeText={setLocation}
            />
            <Input
              label="Opmerking (optioneel)"
              placeholder="Bijv. Ik neem een extra racket mee"
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.noteInput}
            />

            <Button label={submitLabel} onPress={onSubmitPress} loading={submitting} style={styles.submit} />
          </ScrollView>
        </Pressable>
      </Pressable>

      <SelectModal
        visible={sportPickerVisible}
        title="Kies een sport"
        options={TRAINING_SPORT_OPTIONS}
        selectedValue={sport}
        onSelect={setSport}
        onClose={() => setSportPickerVisible(false)}
      />
      <DatePickerModal
        visible={datePickerVisible}
        value={date}
        onChange={setDate}
        onClose={() => setDatePickerVisible(false)}
        minimumDate={new Date()}
      />
      <TimePickerModal visible={timePickerVisible} value={time} onChange={setTime} onClose={() => setTimePickerVisible(false)} />
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
    maxHeight: "85%",
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  preview: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  noteInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
