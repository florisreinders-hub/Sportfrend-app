import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import { signOut } from "@/lib/auth";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen({ navigation }: Props) {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />
      <Text style={styles.header}>INSTELLINGEN</Text>
      <View style={styles.divider} />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
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
        <Text style={styles.sectionTitle}>Voorkeuren</Text>
        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={20} color={colors.black} />
          <Text style={styles.rowLabel}>Pushmeldingen</Text>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.row}>
          <Ionicons name="navigate-outline" size={20} color={colors.black} />
          <Text style={styles.rowLabel}>Locatie delen</Text>
          <Switch value={locationEnabled} onValueChange={setLocationEnabled} trackColor={{ true: colors.primary }} />
        </View>
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

      <Pressable style={styles.row} onPress={() => signOut()}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.rowLabel, styles.logout]}>Uitloggen</Text>
      </Pressable>

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
  logout: {
    color: colors.danger,
  },
});
