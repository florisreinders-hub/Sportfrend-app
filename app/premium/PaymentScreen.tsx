import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { upsertSubscription } from "@/lib/api";

const PLAN_INFO = {
  premium: { label: "Premium", priceCents: 499, priceLabel: "€4,99/mnd" },
  elite: { label: "Elite", priceCents: 999, priceLabel: "€9,99/mnd" },
} as const;

type Props = NativeStackScreenProps<RootStackParamList, "Payment">;

export default function PaymentScreen({ route, navigation }: Props) {
  const { plan } = route.params;
  const info = PLAN_INFO[plan];
  const { session } = useAuth();
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPay = async () => {
    if (!session?.user) return;
    setError(null);
    setLoading(true);
    try {
      await upsertSubscription(session.user.id, plan, info.priceCents);
      navigation.navigate("Settings");
    } catch (e: any) {
      setError(e?.message ?? "Betaling mislukt, probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Betalen" />
      <View style={styles.content}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>{info.label} abonnement</Text>
          <Text style={styles.summaryPrice}>{info.priceLabel}</Text>
        </View>

        <Input
          label="Kaartnummer"
          placeholder="1234 5678 9012 3456"
          keyboardType="number-pad"
          value={cardNumber}
          onChangeText={setCardNumber}
        />
        <View style={styles.row}>
          <Input
            label="Vervaldatum"
            placeholder="MM/JJ"
            keyboardType="number-pad"
            value={expiry}
            onChangeText={setExpiry}
            style={styles.half}
          />
          <Input
            label="CVC"
            placeholder="123"
            keyboardType="number-pad"
            secureTextEntry
            value={cvc}
            onChangeText={setCvc}
            style={styles.half}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={`Betaal ${info.priceLabel}`}
          onPress={onPay}
          loading={loading}
          disabled={!cardNumber || !expiry || !cvc}
          style={styles.cta}
        />
        <Text style={styles.disclaimer}>
          Dit is een demo-betaalscherm. Koppel Stripe of Mollie via EXPO_PUBLIC_PAYMENTS_PUBLIC_KEY voor echte betalingen.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  summaryPrice: {
    fontFamily: fonts.body,
    fontSize: fontSizes.lg,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },
  cta: {
    marginTop: spacing.sm,
  },
  disclaimer: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
});
