import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SelectModal } from "@/components/SelectModal";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { LEVEL_OPTIONS } from "@/constants/levels";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { getDataErrorMessage, Profile } from "@/lib/api";
import { sportPhotoPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

// The picker also offers "Alle niveaus" (value: null) as a filter option
// elsewhere - not meaningful when picking a single level for a profile.
const PROFILE_LEVEL_OPTIONS = LEVEL_OPTIONS.filter((o) => o.value !== null);

export default function EditProfileScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [sport, setSport] = useState("");
  const [level, setLevel] = useState<string | null>(null);
  const [levelPickerVisible, setLevelPickerVisible] = useState(false);
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setLoadError(getDataErrorMessage(fetchError));
          setLoading(false);
          return;
        }
        const profile = data as Profile | null;
        if (profile) {
          setFullName(profile.full_name ?? "");
          setSport(profile.sport ?? "");
          setLevel(profile.level ?? null);
          setCity(profile.city ?? "");
          setBio(profile.bio ?? "");
          setPhotoUrl(profile.photo_url ?? null);
        }
        setLoading(false);
      });
  }, [session?.user]);

  const levelLabel = PROFILE_LEVEL_OPTIONS.find((o) => o.value === level)?.label ?? "Kies je niveau";

  const onPickPhoto = async () => {
    if (!session?.user || uploadingPhoto) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const extMatch = uri.match(/\.(\w+)$/);
      const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
      const contentType = ext === "png" ? "image/png" : "image/jpeg";
      // Unique filename per upload (not a stable "profile.<ext>" path) so
      // the public URL actually changes and every screen showing this
      // photo picks up the new one immediately, instead of everyone's
      // cached copy of the old image at the same URL sticking around.
      const path = `${session.user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, arrayBuffer, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
      setPhotoUrl(publicUrlData.publicUrl);
    } catch (e) {
      Alert.alert("Upload mislukt", getDataErrorMessage(e));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSave = async () => {
    if (!session?.user) return;
    setSaving(true);
    setSaveError(null);
    // upsert (not update): a profile row might not exist yet for this
    // user for whatever reason - see LocationSetupScreen's saveLocation
    // for the same reasoning (a plain .update() would silently match zero
    // rows and "succeed" without writing anything in that case).
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: session.user.id, full_name: fullName, sport, level, city, bio, photo_url: photoUrl }, { onConflict: "id" });
    setSaving(false);
    if (error) {
      setSaveError(getDataErrorMessage(error));
      return;
    }
    navigation.goBack();
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : loadError ? (
        <Text style={styles.loadErrorText}>{loadError}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Pressable onPress={onPickPhoto} disabled={uploadingPhoto} style={styles.photoWrap}>
              <Image
                source={{ uri: photoUrl ?? sportPhotoPlaceholder(session?.user?.id ?? "me") }}
                style={styles.photo}
              />
              <View style={styles.photoEditBadge}>
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.black} />
                )}
              </View>
            </Pressable>
            <Button label="Opslaan" onPress={onSave} loading={saving} style={styles.saveButton} />
          </View>

          {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <Input label="Naam" value={fullName} onChangeText={setFullName} placeholder="Peter Jansen" />
          <Input label="Sport" value={sport} onChangeText={setSport} placeholder="Golf" />

          <Text style={styles.label}>Niveau</Text>
          <Pressable style={styles.levelPicker} onPress={() => setLevelPickerVisible(true)}>
            <Text style={styles.levelPickerText}>{levelLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </Pressable>

          <Input label="Locatie" value={city} onChangeText={setCity} placeholder="Amsterdam" />
          <Input
            label="Over mij"
            value={bio}
            onChangeText={setBio}
            placeholder="Vertel iets over jezelf"
            multiline
            style={styles.bioInput}
          />
        </ScrollView>
      )}

      <SelectModal
        visible={levelPickerVisible}
        title="Kies je niveau"
        options={PROFILE_LEVEL_OPTIONS}
        selectedValue={level}
        onSelect={setLevel}
        onClose={() => setLevelPickerVisible(false)}
      />

      <BottomNav active="profiel" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  loadErrorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  saveErrorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  photoWrap: {
    width: 87,
    height: 100,
  },
  photo: {
    width: 87,
    height: 100,
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  photoEditBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButton: {
    width: 140,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  levelPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  levelPickerText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  bioInput: {
    height: 96,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
});
