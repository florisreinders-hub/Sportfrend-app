import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { signOut } from "@/lib/auth";
import { fetchProfileSettings, getDataErrorMessage, updateProfileSettings } from "@/lib/api";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      setLoading(true);
      fetchProfileSettings(userId)
        .then((settings) => {
          if (cancelled) return;
          setPushEnabled(settings.push_notifications_enabled);
          setProfileVisible(settings.profile_visible);
        })
        .catch((e) => Alert.alert("Kon instellingen niet laden", getDataErrorMessage(e)))
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [userId])
  );

  const onTogglePush = async (value: boolean) => {
    setPushEnabled(value);
    if (!userId) return;
    try {
      await updateProfileSettings(userId, { push_notifications_enabled: value });
    } catch (e) {
      setPushEnabled(!value);
      Alert.alert("Opslaan mislukt", getDataErrorMessage(e));
    }
  };

  const onToggleVisible = async (value: boolean) => {
    setProfileVisible(value);
    if (!userId) return;
    try {
      await updateProfileSettings(userId, { profile_visible: value });
    } catch (e) {
      setProfileVisible(!value);
      Alert.alert("Opslaan mislukt", getDataErrorMessage(e));
    }
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) throw error;
      // AuthContext's onAuthStateChange picks up the cleared session and
      // RootNavigator switches back to the signed-out stack on its own.
    } catch (e) {
      setSigningOut(false);
      Alert.alert("Uitloggen mislukt", getDataErrorMessage(e));
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>INSTELLINGEN</Text>
      <View style={styles.divider} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <Pressable style={styles.row} onPress={() => navigation.navigate("EditProfile")}>
              <Ionicons name="person-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Mijn profiel bewerken</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("ChangeEmail")}>
              <Ionicons name="mail-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>E-mail wijzigen</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("LocationSetup")}>
              <Ionicons name="location-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Locatie wijzigen</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("Pricing")}>
              <Ionicons name="star-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Abonnement beheren</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notificatievoorkeuren</Text>
            <View style={styles.row}>
              <Ionicons name="notifications-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Pushmeldingen</Text>
              <Switch value={pushEnabled} onValueChange={onTogglePush} trackColor={{ true: colors.primary }} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.row}>
              <Ionicons name="eye-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Profiel zichtbaar in Ontdekken</Text>
              <Switch value={profileVisible} onValueChange={onToggleVisible} trackColor={{ true: colors.primary }} />
            </View>
            <Text style={styles.hint}>
              {profileVisible
                ? "Andere gebruikers kunnen je profiel vinden in Ontdekken."
                : "Je profiel wordt niet meer getoond aan andere gebruikers in Ontdekken."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ondersteuning</Text>
            <Pressable style={styles.row} onPress={() => navigation.navigate("Helpdesk")}>
              <Ionicons name="help-circle-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Helpdesk</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("Faq")}>
              <Ionicons name="document-text-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Veelgestelde vragen</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("Support")}>
              <Ionicons name="headset-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Klantenservice</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable style={styles.row} onPress={onSignOut} disabled={signingOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, styles.logout]}>{signingOut ? "Bezig met uitloggen..." : "Uitloggen"}</Text>
          </Pressable>
        </>
      )}

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  logout: {
    color: colors.danger,
  },
});
