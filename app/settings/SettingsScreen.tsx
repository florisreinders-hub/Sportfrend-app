import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { BOTTOM_NAV_HEIGHT, colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { deleteAccount, signOut } from "@/lib/auth";
import { fetchProfileSettings, getDataErrorMessage, updateProfileSettings } from "@/lib/api";
import { MODERATOR_EMAIL } from "@/constants/moderator";
import { presentCustomerCenter } from "@/lib/purchases";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

// Tijdelijk verborgen op verzoek (de rest van de Trainings & Buddy
// Planner-functie - "Plan een training" in de chat, voorstellen/
// accepteren/afwijzen - blijft gewoon actief; alleen dit
// overzichtsscherm in Instellingen is uit het zicht). Zet terug op
// `true` om de rij weer te tonen - de route/het scherm zelf
// (MyTrainingsScreen, navigation/types.ts's "MyTrainings") is niet
// verwijderd.
const SHOW_MY_TRAININGS_ROW = false;

export default function SettingsScreen({ navigation }: Props) {
  const { session, plan } = useAuth();
  const userId = session?.user?.id;
  // .toLowerCase() aan beide kanten: Supabase Auth normaliseert een
  // e-mailadres doorgaans naar lowercase, maar een exacte === zonder dit
  // zou bij de kleinste afwijking (bv. een adres dat ooit met een
  // hoofdletter is ingevoerd) deze rij stilletjes nooit tonen, zonder
  // enige foutmelding - precies zo'n stil-falende vergelijking is de
  // dienst geweest bij eerdere bugs in dit project. is_moderator() in de
  // database (0030_moderator_email_case_insensitive.sql) is op dezelfde
  // manier gehard, want dat is de échte grens - dit hier is alleen UX.
  const isModerator = session?.user?.email?.toLowerCase() === MODERATOR_EMAIL.toLowerCase();
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [profileVisible, setProfileVisible] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // "Abonnement beheren": Pricing (choose/upgrade) for a Basis account,
  // RevenueCat's own Customer Center (cancel, change plan, view purchase
  // history, request a refund on iOS) for an already-paying one - there's
  // nothing to "manage" via Pricing once a plan is active, and presenting
  // the paywall again for an upgrade/downgrade is exactly what Customer
  // Center's own "change plans" option already covers.
  const onManageSubscription = async () => {
    if (plan === "basis") {
      navigation.navigate("Pricing");
      return;
    }
    try {
      await presentCustomerCenter();
    } catch (e) {
      Alert.alert("Kon niet openen", getDataErrorMessage(e));
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

  // Dev-only (__DEV__, see the render below) - deliberately thrown inside
  // an event handler, not during render, so this does NOT get caught by
  // ErrorBoundary.tsx (a component tree error boundary only catches
  // render/lifecycle errors, never an event-handler throw - see React's
  // own docs on error boundaries). It's meant to exercise the *other*
  // capture path instead: lib/sentry.ts's initSentry() default
  // integrations install a global `ErrorUtils` handler specifically for
  // this kind of "uncaught JS exception outside render" case. Tapping this
  // should therefore surface as a new issue in the Sentry dashboard within
  // a few seconds, tagged with this build's release/dist (see
  // README.md's "Sentry crash-reporting" section for how to verify this).
  const onTestCrash = () => {
    throw new Error("Sentry test-crash vanuit Instellingen (SettingsScreen.tsx, __DEV__-only knop)");
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Account verwijderen",
      "Weet je het zeker? Dit kan niet ongedaan gemaakt worden. Je profiel, matches, berichten, posts en alle andere gegevens worden permanent verwijderd.",
      [
        { text: "Annuleren", style: "cancel" },
        {
          text: "Verwijderen",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              // Same as onSignOut: AuthContext picks up the cleared session
              // and RootNavigator switches back to the signed-out stack
              // (Login) on its own.
            } catch (e) {
              setDeleting(false);
              Alert.alert("Verwijderen mislukt", getDataErrorMessage(e));
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>INSTELLINGEN</Text>
      <View style={styles.divider} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Pressable style={styles.row} onPress={onManageSubscription}>
              <Ionicons name="star-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Abonnement beheren</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.row} onPress={() => navigation.navigate("DataExport")}>
              <Ionicons name="download-outline" size={20} color={colors.black} />
              <Text style={styles.rowLabel}>Mijn gegevens opvragen</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
            {SHOW_MY_TRAININGS_ROW ? (
              <Pressable style={styles.row} onPress={() => navigation.navigate("MyTrainings")}>
                <Ionicons name="barbell-outline" size={20} color={colors.black} />
                <Text style={styles.rowLabel}>Mijn trainingen</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
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

          <Pressable style={styles.row} onPress={onDeleteAccount} disabled={deleting}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, styles.logout]}>
              {deleting ? "Account wordt verwijderd..." : "Account verwijderen"}
            </Text>
          </Pressable>

          {isModerator ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Moderatie</Text>
              <Pressable style={styles.row} onPress={() => navigation.navigate("Moderation")}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.black} />
                <Text style={styles.rowLabel}>Moderatie-overzicht</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          {__DEV__ ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ontwikkelaar</Text>
              <Pressable style={styles.row} onPress={onTestCrash}>
                <Ionicons name="bug-outline" size={20} color={colors.danger} />
                <Text style={[styles.rowLabel, styles.logout]}>Test crash (Sentry)</Text>
              </Pressable>
              <Text style={styles.hint}>
                Alleen zichtbaar in development. Gooit een onafgehandelde fout buiten React's render-cyclus om
                (dus niet via ErrorBoundary.tsx) - hiermee verifieer je dat lib/sentry.ts's globale
                foutafhandeling een fout daadwerkelijk naar het Sentry-dashboard stuurt.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: BOTTOM_NAV_HEIGHT + spacing.md,
  },
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
