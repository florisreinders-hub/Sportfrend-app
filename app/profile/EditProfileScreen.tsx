import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/api";
import { sportPhotoPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export default function EditProfileScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [sport, setSport] = useState("");
  const [level, setLevel] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (!session?.user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        const profile = data as Profile | null;
        if (profile) {
          setFullName(profile.full_name ?? "");
          setSport(profile.sport ?? "");
          setLevel(profile.level ?? "");
          setCity(profile.city ?? "");
          setBio(profile.bio ?? "");
        }
        setLoading(false);
      });
  }, [session?.user]);

  const onSave = async () => {
    if (!session?.user) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ full_name: fullName, sport, level, city, bio })
      .eq("id", session.user.id);
    setSaving(false);
    navigation.goBack();
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headerRow}>
            <Image
              source={{ uri: sportPhotoPlaceholder(session?.user?.id ?? "me") }}
              style={styles.photo}
            />
            <Button label="Opslaan" onPress={onSave} loading={saving} style={styles.saveButton} />
          </View>

          <Text style={styles.sectionTitle}>DETAILS</Text>
          <Input label="Naam" value={fullName} onChangeText={setFullName} placeholder="Peter Jansen" />
          <Input label="Sport" value={sport} onChangeText={setSport} placeholder="Golf" />
          <Input label="Niveau" value={level} onChangeText={setLevel} placeholder="Handicap 18" />
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

      <BottomNav active="profiel" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  photo: {
    width: 87,
    height: 100,
    borderRadius: 4,
    backgroundColor: colors.surface,
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
  bioInput: {
    height: 96,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
});
