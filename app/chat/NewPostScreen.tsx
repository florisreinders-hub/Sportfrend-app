import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { createPost } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "NewPost">;

export default function NewPostScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

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
    if (!body.trim() || !session?.user) return;
    setPosting(true);
    try {
      await createPost(session.user.id, body.trim(), imageUri ?? undefined);
      navigation.goBack();
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
        placeholder="Waar wil je over sporten praten?"
        value={body}
        onChangeText={setBody}
        multiline
        style={styles.bodyInput}
      />

      {imageUri ? <View style={styles.imagePreview} /> : null}

      <View style={styles.toolRow}>
        <Pressable onPress={pickImage} style={styles.toolButton}>
          <Ionicons name="image-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>Foto</Text>
        </Pressable>
        <Pressable style={styles.toolButton}>
          <Ionicons name="calendar-outline" size={22} color={colors.black} />
          <Text style={styles.toolLabel}>Datum</Text>
        </Pressable>
      </View>

      <Button label="Plaatsen" onPress={onPost} loading={posting} disabled={!body.trim()} style={styles.cta} />
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
    height: 120,
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
  cta: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xl,
  },
});
