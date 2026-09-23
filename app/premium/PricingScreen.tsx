import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchCustomerInfo, getPlanFromCustomerInfo, isPurchasesConfigured, PlanId, presentPaywallForPlan } from "@/lib/purchases";

type Plan = {
  id: "basis" | PlanId;
  name: string;
  price: string;
  period: string;
  features: string[];
};

// Content and per-plan feature lists verified against Figma node 2003:3819.
// Prices shown here are "vanaf" (starting from, monthly) - RevenueCatUI's
// paywall (onChoose below) shows the real, localized price for both the
// monthly and yearly package once presented; this card is a comparison/
// marketing screen, not the actual checkout.
const BASIS: Plan = {
  id: "basis",
  name: "Basis",
  price: "Gratis",
  period: "",
  features: ["5 Dagelijkse aanbevelingen", "Basisfilters", "Profiel toevoegen aan community", "3 Berichten per dag sturen"],
};

const PREMIUM: Plan = {
  id: "premium",
  name: "Premium",
  price: "4,99",
  period: "Vanaf €/mnd",
  features: [
    "15 dagelijkse sportmaatje suggesties",
    "Meer kans op een geschikt sportmaatje",
    "Onbeperkt chatten",
    "Uitgebreide filters",
    "connecties toevoegen",
    "Ervaringen delen",
  ],
};

const ELITE: Plan = {
  id: "elite",
  name: "Elite",
  price: "9,99",
  period: "Vanaf €/mnd",
  features: [
    "Onbeperkt dagelijkse sportmaatje suggesties",
    "Prioriteit in aanbevelingen",
    "Slimme beschikbaarheids match",
    "Onbeperkt chatten",
    "Uitgebreide filters",
    "connecties toevoegen",
    "Trainings & Buddy Planner",
  ],
};

type Props = NativeStackScreenProps<RootStackParamList, "Pricing">;

export default function PricingScreen({ navigation }: Props) {
  const { session, customerInfo: contextCustomerInfo } = useAuth();
  const [purchasingPlan, setPurchasingPlan] = useState<PlanId | null>(null);
  // Re-fetched on focus (not just read from AuthContext's cached value) so
  // returning here after managing/canceling a subscription elsewhere
  // (Instellingen's Customer Center) reflects the change immediately,
  // rather than waiting for the next CustomerInfo update event.
  const [currentPlan, setCurrentPlan] = useState(getPlanFromCustomerInfo(contextCustomerInfo));

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchCustomerInfo().then((info) => {
        if (!cancelled) setCurrentPlan(getPlanFromCustomerInfo(info));
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onChoose = async (plan: Plan) => {
    if (plan.id === "basis" || !session?.user || purchasingPlan) return;
    if (!isPurchasesConfigured) {
      Alert.alert(
        "Nog niet beschikbaar",
        "In-app aankopen zijn nog niet geconfigureerd voor deze build. Zie README.md's \"RevenueCat\"-sectie."
      );
      return;
    }
    setPurchasingPlan(plan.id);
    try {
      const { result, customerInfo } = await presentPaywallForPlan(plan.id);
      switch (result) {
        case "PURCHASED":
        case "RESTORED":
          setCurrentPlan(getPlanFromCustomerInfo(customerInfo));
          Alert.alert("Gelukt!", `Je hebt nu toegang tot ${plan.name}.`, [
            { text: "OK", onPress: () => navigation.navigate("Settings") },
          ]);
          break;
        case "ERROR":
          Alert.alert("Aankoop mislukt", "Er is iets misgegaan bij het verwerken van je aankoop. Probeer het opnieuw.");
          break;
        case "CANCELLED":
        case "NOT_PRESENTED":
        default:
          // User backed out of the paywall, or it couldn't be shown (e.g.
          // offering not configured yet in the RevenueCat dashboard) -
          // RevenueCatUI already surfaces its own error state for the
          // latter case, nothing more to show here.
          break;
      }
    } finally {
      setPurchasingPlan(null);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Premium" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <PlanCard plan={BASIS} onChoose={onChoose} purchasing={false} isCurrent={currentPlan === "basis"} />
          <PlanCard
            plan={PREMIUM}
            onChoose={onChoose}
            purchasing={purchasingPlan === "premium"}
            isCurrent={currentPlan === "premium"}
          />
        </View>
        <View style={styles.row}>
          <PlanCard plan={ELITE} onChoose={onChoose} purchasing={purchasingPlan === "elite"} isCurrent={currentPlan === "elite"} />
        </View>
      </ScrollView>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

function PlanCard({
  plan,
  onChoose,
  purchasing,
  isCurrent,
}: {
  plan: Plan;
  onChoose: (plan: Plan) => void;
  purchasing: boolean;
  isCurrent: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.planName}>{plan.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{plan.price}</Text>
        {plan.period ? <Text style={styles.period}>{plan.period}</Text> : null}
      </View>

      {plan.features.map((feature) => (
        <Text key={feature} style={styles.featureLabel}>
          {feature}
        </Text>
      ))}

      {isCurrent ? (
        <Text style={styles.included}>{plan.id === "basis" ? "Inbegrepen" : "Actief"}</Text>
      ) : (
        <Pressable style={styles.choosePill} onPress={() => onChoose(plan)} disabled={purchasing}>
          {purchasing ? <ActivityIndicator size="small" color={colors.black} /> : <Text style={styles.chooseLabel}>Kies</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.sm,
  },
  planName: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  period: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
    marginLeft: 4,
  },
  featureLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.black,
    marginBottom: spacing.xs,
  },
  included: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  choosePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.xs,
    minWidth: 64,
    alignItems: "center",
  },
  chooseLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
});
