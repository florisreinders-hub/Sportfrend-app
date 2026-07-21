import React, { useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { getDataErrorMessage, upsertSubscription } from "@/lib/api";
import { purchasePlanSandbox, restorePurchasesSandbox } from "@/lib/purchases";

const PLAN_INFO = {
  premium: { label: "Premium", priceCents: 499, price: "4,99" },
  elite: { label: "Elite", priceCents: 999, price: "9,99" },
} as const;

type Props = NativeStackScreenProps<RootStackParamList, "Payment">;

export default function PaymentScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const info = PLAN_INFO[plan];
  const { session } = useAuth();
  const [paying, setPaying] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const onPay = async () => {
    if (!session?.user || paying) return;
    setPaying(true);
    try {
      const result = await purchasePlanSandbox(plan);
      if (!result.success) {
        Alert.alert("Aankoop mislukt", result.error);
        return;
      }
      // Sandbox stands in for the store's purchase sheet actually
      // completing - once that's real, RevenueCat's webhook/SDK would be
      // the source of truth for "active" instead of setting it here.
      await upsertSubscription(session.user.id, plan, info.priceCents);
      Alert.alert("Aankoop gelukt (sandbox)", `Je hebt nu toegang tot ${info.label}.`, [
        { text: "OK", onPress: () => navigation.navigate("Settings") },
      ]);
    } catch (e) {
      Alert.alert("Opslaan mislukt", getDataErrorMessage(e));
    } finally {
      setPaying(false);
    }
  };

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      await restorePurchasesSandbox();
      Alert.alert("Sandbox-modus", "Er zijn nog geen echte aankopen om te herstellen - dit is een testomgeving.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar title="Betalen" />

      <View style={styles.content}>
        <View style={styles.sandboxBanner}>
          <Ionicons name="flask-outline" size={16} color={colors.primaryDark} />
          <Text style={styles.sandboxText}>
            Sandbox-modus: er wordt geen echte betaling verwerkt. Zie README.md voor de RevenueCat-koppeling.
          </Text>
        </View>

        <View style={styles.iconWrap}>
          <Ionicons name="logo-euro" size={120} color={colors.primary} />
        </View>

        <Text style={styles.planLabel}>{info.label}-abonnement</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{info.price}</Text>
          <Text style={styles.pricePeriod}>/mnd</Text>
        </View>

        <View style={styles.methodRow}>
          <Text style={styles.methodLabel}>Betaalmethode</Text>
          <Text style={styles.methodValue}>{Platform.OS === "ios" ? "App Store" : "Google Play"}</Text>
        </View>

        <Pressable style={styles.payButton} onPress={onPay} disabled={paying}>
          {paying ? <ActivityIndicator color={colors.black} /> : <Text style={styles.payLabel}>Betalen</Text>}
        </Pressable>

        <Pressable onPress={onRestore} disabled={restoring} hitSlop={8}>
          <Text style={styles.restoreLabel}>{restoring ? "Bezig..." : "Aankopen herstellen"}</Text>
        </Pressable>
      </View>

      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sandboxBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.sm,
    width: "100%",
  },
  sandboxText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
  },
  iconWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  planLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.black,
  },
  pricePeriod: {
    fontFamily: fonts.body,
    fontSize: fontSizes.lg,
    color: colors.black,
    marginLeft: 4,
    marginBottom: 6,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%",
    marginBottom: spacing.xl,
  },
  methodLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
  },
  methodValue: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    height: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  payLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  restoreLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textDecorationLine: "underline",
    marginTop: spacing.md,
  },
});
