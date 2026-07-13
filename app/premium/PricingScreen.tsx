import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Plan = {
  id: "basis" | "premium" | "elite";
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
};

const plans: Plan[] = [
  {
    id: "basis",
    name: "Basis",
    price: "Gratis",
    period: "",
    features: ["Onbeperkt swipen", "Chatten met connecties", "1 sport in je profiel"],
  },
  {
    id: "premium",
    name: "Premium",
    price: "€4,99",
    period: "/mnd",
    highlight: true,
    features: [
      "Alles uit Basis",
      "Zie wie jou al leuk vindt",
      "Onbeperkt aantal sporten",
      "Uitgebreide filters",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: "€9,99",
    period: "/mnd",
    features: [
      "Alles uit Premium",
      "Prioriteit in de Ontdekken-lijst",
      "Persoonlijke sportmaatje-suggesties",
      "Geen advertenties",
    ],
  },
];

type Props = NativeStackScreenProps<RootStackParamList, "Pricing">;

export default function PricingScreen({ navigation }: Props) {
  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Premium & Elite" />
      <ScrollView contentContainerStyle={styles.content}>
        {plans.map((plan) => (
          <View key={plan.id} style={[styles.card, plan.highlight && styles.cardHighlight]}>
            {plan.highlight ? (
              <View style={styles.badge}>
                <Text style={styles.badgeLabel}>Populair</Text>
              </View>
            ) : null}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{plan.price}</Text>
              <Text style={styles.period}>{plan.period}</Text>
            </View>
            {plan.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.featureLabel}>{feature}</Text>
              </View>
            ))}
            <Button
              label={plan.id === "basis" ? "Huidig plan" : `Kies ${plan.name}`}
              variant={plan.id === "basis" ? "outline" : "primary"}
              disabled={plan.id === "basis"}
              onPress={() => navigation.navigate("Payment", { plan: plan.id as "premium" | "elite" })}
              style={styles.cta}
            />
          </View>
        ))}
      </ScrollView>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  badgeLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.black,
  },
  planName: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.black,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: spacing.sm,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xxl,
    color: colors.black,
  },
  period: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    marginBottom: 4,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  featureLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.black,
  },
  cta: {
    marginTop: spacing.sm,
  },
});
