import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { getDataErrorMessage, selectPendingPlan } from "@/lib/api";

type Plan = {
  id: "basis" | "premium" | "elite";
  name: string;
  price: string;
  period: string;
  priceCents: number;
  features: string[];
};

// Content and per-plan feature lists verified against Figma node 2003:3819.
const BASIS: Plan = {
  id: "basis",
  name: "Basis",
  price: "Gratis",
  period: "",
  priceCents: 0,
  features: ["5 Dagelijkse aanbevelingen", "Basisfilters", "Profiel toevoegen aan community", "3 Berichten per dag sturen"],
};

const PREMIUM: Plan = {
  id: "premium",
  name: "Premium",
  price: "4,99",
  period: "P/mnd",
  priceCents: 499,
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
  period: "P/mnd",
  priceCents: 999,
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
  const { session } = useAuth();
  const [savingPlan, setSavingPlan] = useState<"premium" | "elite" | null>(null);

  const onChoose = async (plan: Plan) => {
    if (plan.id === "basis" || !session?.user) return;
    setSavingPlan(plan.id);
    try {
      // Saves the choice ahead of the payment flow (status "pending", not
      // "active" - PaymentScreen only marks it active once it actually
      // "pays"), so it's there to prefill/resume the checkout even if the
      // user backs out before finishing payment.
      await selectPendingPlan(session.user.id, plan.id, plan.priceCents);
      navigation.navigate("Payment", { plan: plan.id });
    } catch (e) {
      Alert.alert("Opslaan mislukt", getDataErrorMessage(e));
    } finally {
      setSavingPlan(null);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Premium" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <PlanCard plan={BASIS} onChoose={onChoose} saving={false} />
          <PlanCard plan={PREMIUM} onChoose={onChoose} saving={savingPlan === "premium"} />
        </View>
        <View style={styles.row}>
          <PlanCard plan={ELITE} onChoose={onChoose} saving={savingPlan === "elite"} />
        </View>
      </ScrollView>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

function PlanCard({ plan, onChoose, saving }: { plan: Plan; onChoose: (plan: Plan) => void; saving: boolean }) {
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

      {plan.id === "basis" ? (
        <Text style={styles.included}>Inbegrepen</Text>
      ) : (
        <Pressable style={styles.choosePill} onPress={() => onChoose(plan)} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.black} /> : <Text style={styles.chooseLabel}>Kies</Text>}
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
