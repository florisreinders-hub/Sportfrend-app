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
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { SPORT_OPTIONS } from "@/constants/sports";
import { useAuth } from "@/lib/AuthContext";
import { createPost, getDataErrorMessage } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "NewPost">;

// The picker also offers "Alle sporten" (value: null) as a filter option
// elsewhere - not meaningful when picking a single sport for a post.
const POST_SPORT_OPTIONS = SPORT_OPTIONS.filter((o) => o.value !== null);

/** "DD-MM-JJJJ" -> ISO "YYYY-MM-DD", or null if not a real calendar date. */
function parseDutchDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const date = new Date(year, month - 1, day);
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!isRealDate) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ISO "YYYY-MM-DD" -> "DD-MM-JJJJ", for pre-filling the manual date field. */
function isoToDutchDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

export default function NewPostScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const prefilledDate = route.params?.eventDate;
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [sportPickerVisible, setSportPickerVisible] = useState(false);
  const [showDate, setShowDate] = useState(Boolean(prefilledDate));
  const [dateText, setDateText] = useState(prefilledDate ? isoToDutchDate(prefilledDate) : "");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sportLabel = POST_SPORT_OPTIONS.find((o) => o.value === sport)?.label ?? "Sport toevoegen";

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

    // Datum is fully optional (requirement: a post must succeed with no
    // date picked at all) - only validate/send it when the user actually
    // opened the date row and typed something in it.
    let eventDate: string | null = null;
    if (showDate && dateText.trim()) {
      eventDate = parseDutchDate(dateText);
      if (!eventDate) {
        setError("Vul een geldige datum in (DD-MM-JJJJ).");
        return;
      }
    }

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
        <Pressable style={styles.toolButton} onPress={() => setShowDate((v) => !v)}>
          <Ionicons name="calendar-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>Datum (optioneel)</Text>
        </Pressable>
      </View>

      {showDate ? (
        <Input
          placeholder="DD-MM-JJJJ"
          value={dateText}
          onChangeText={setDateText}
          keyboardType="number-pad"
          style={styles.dateInput}
        />
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
  dateInput: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
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
