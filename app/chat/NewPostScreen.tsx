import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SelectModal } from "@/components/SelectModal";
import { DatePickerModal } from "@/components/DatePickerModal";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { SPORT_OPTIONS } from "@/constants/sports";
import { useAuth } from "@/lib/AuthContext";
import { createPost, formatEventDateTime, getDataErrorMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "NewPost">;

// The picker also offers "Alle sporten" (value: null) as a filter option
// elsewhere - not meaningful when picking a single sport for a post.
const POST_SPORT_OPTIONS = SPORT_OPTIONS.filter((o) => o.value !== null);

export default function NewPostScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  // ISO "YYYY-MM-DD" or null - picked via a native calendar, never typed, so
  // there's no string format to get wrong and nothing to validate here.
  const [eventDate, setEventDate] = useState<string | null>(route.params?.eventDate ?? null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportLabel = POST_SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Sport toevoegen";
  const dateLabel = eventDate ? formatEventDateTime(eventDate) : null;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onPost = async () => {
    if (!body.trim() || !session?.user || posting) return;
    setError(null);

    setPosting(true);
    try {
      await createPost(session.user.id, body.trim(), {
        imageUrl: imageUri ?? undefined,
        sport,
        eventDate,
      });
      navigation.goBack();
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setPosting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.title}>Bericht plaatsen</Text>
      </View>

      <Input
        placeholder="Wie heeft zin om te padellen dit weekend?"
        value={body}
        onChangeText={setBody}
        multiline
        style={styles.bodyInput}
      />

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.imagePreview} /> : null}

      <View style={styles.toolRow}>
        <Pressable onPress={pickImage} style={styles.toolButton}>
          <Ionicons name="image-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>Foto</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => setSportPickerVisible(true)}>
          <Ionicons name="basketball-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>{sportLabel}</Text>
        </Pressable>
        <Pressable style={styles.toolButton} onPress={() => setDatePickerVisible(true)}>
          <Ionicons name="calendar-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>{dateLabel ?? "Datum (optioneel)"}</Text>
        </Pressable>
      </View>

      {dateLabel ? (
        <Pressable style={styles.clearDate} onPress={() => setEventDate(null)} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          <Text style={styles.clearDateText}>Datum verwijderen</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Plaatsen" onPress={onPost} loading={posting} disabled={!body.trim()} style={styles.cta} />

      <SelectModal
        visible={sportPickerVisible}
        title="Kies een sport"
        options={POST_SPORT_OPTIONS}
        selectedValue={sport}
        onSelect={setSport}
        onClose={() => setSportPickerVisible(false)}
      />

      <DatePickerModal
        visible={datePickerVisible}
        value={eventDate}
        onChange={setEventDate}
        onClose={() => setDatePickerVisible(false)}
        minimumDate={new Date()}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  bodyInput: {
    marginHorizontal: spacing.md,
    height: 100,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  imagePreview: {
    marginHorizontal: spacing.md,
    height: 160,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  toolRow: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  toolLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  clearDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  clearDateText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  cta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
