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
import { getDataErrorMessage } from "@/lib/api";
import {
  fetchCustomerInfo,
  getPlanFromCustomerInfo,
  isPurchasesConfigured,
  PlanId,
  presentPaywallForPlan,
  restorePurchases,
} from "@/lib/purchases";
import { openLegalUrl, PRIVACY_URL, TERMS_URL } from "@/constants/legal";

type Plan = {
  id: "basis" | PlanId;
  name: string;
  price: string;
  period: string;
  features: string[];
};

// Content and per-plan feature lists verified against Figma node 2003:3819.
// Prices shown here are the monthly price, store-review guideline
// requirement 3.1.2 wording ("€4,99 / mnd") - RevenueCatUI's paywall
// (onChoose below) shows the real, localized price (and the yearly
// package) once presented; this card is a comparison/marketing screen,
// not the actual checkout, which is why the renewal-terms text and legal
// links below the plan cards matter here too, not just in the paywall.
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
  price: "€4,99",
  period: "/ mnd",
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
  price: "€9,99",
  period: "/ mnd",
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
        case "NOT_PRESENTED":
          // The paywall itself couldn't be shown at all (e.g. the offering
          // isn't configured yet in the RevenueCat dashboard) - distinct
          // from CANCELLED (the user saw it and backed out themselves),
          // so this needs its own message rather than failing silently.
          Alert.alert("Niet beschikbaar", "Het betaalscherm kon niet geopend worden, probeer het later opnieuw.");
          break;
        case "ERROR":
          Alert.alert("Aankoop mislukt", "Er is iets misgegaan bij het verwerken van je aankoop. Probeer het opnieuw.");
          break;
        case "CANCELLED":
        default:
          // User backed out of the paywall themselves - no error to show.
          break;
      }
    } catch (e) {
      // Distinct from the ERROR case above (a *result* the paywall itself
      // reports) - this is presentPaywallForPlan() throwing outright, e.g.
      // the native module isn't actually linked in this binary yet (an
      // OTA update shipped this code ahead of a matching native build -
      // see README.md's "RevenueCat" section).
      Alert.alert("Aankoop mislukt", getDataErrorMessage(e));
    } finally {
      setPurchasingPlan(null);
    }
  };

  const [restoring, setRestoring] = useState(false);

  const onRestore = async () => {
    if (restoring) return;
    if (!isPurchasesConfigured) {
      Alert.alert(
        "Nog niet beschikbaar",
        "In-app aankopen zijn nog niet geconfigureerd voor deze build. Zie README.md's \"RevenueCat\"-sectie."
      );
      return;
    }
    setRestoring(true);
    try {
      const { foundActiveEntitlement, customerInfo } = await restorePurchases();
      setCurrentPlan(getPlanFromCustomerInfo(customerInfo));
      Alert.alert(
        foundActiveEntitlement ? "Aankopen herstellen" : "Niets te herstellen",
        foundActiveEntitlement
          ? "Je eerdere aankoop is herkend en hersteld."
          : "Er zijn geen eerdere aankopen gevonden om te herstellen op dit account."
      );
    } catch (e) {
      Alert.alert("Herstellen mislukt", getDataErrorMessage(e));
    } finally {
      setRestoring(false);
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

        <Text style={styles.renewalNotice}>
          Abonnementen worden automatisch verlengd tot je opzegt. Opzeggen kan op elk moment via de instellingen van
          de App Store of Google Play, minstens 24 uur voor het einde van de lopende periode.
        </Text>

        <View style={styles.legalLinksRow}>
          <Text style={styles.legalLink} onPress={() => openLegalUrl(PRIVACY_URL)}>
            Privacyverklaring
          </Text>
          <Text style={styles.legalSeparator}>·</Text>
          <Text style={styles.legalLink} onPress={() => openLegalUrl(TERMS_URL)}>
            Algemene voorwaarden
          </Text>
        </View>

        <Pressable style={styles.restoreButton} onPress={onRestore} disabled={restoring}>
          {restoring ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Text style={styles.restoreLabel}>Aankopen herstellen</Text>
          )}
        </Pressable>
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
  renewalNotice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  legalLinksRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  legalLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    color: colors.primaryDark,
    textDecorationLine: "underline",
  },
  legalSeparator: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  restoreButton: {
    alignSelf: "center",
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  restoreLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    textDecorationLine: "underline",
  },
});
