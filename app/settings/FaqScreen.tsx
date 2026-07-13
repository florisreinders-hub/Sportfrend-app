import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

const faqs = [
  {
    q: "Hoe werkt matchen op Sportfrend?",
    a: "Swipe naar rechts (Connect) als je iemand leuk vindt, of naar links (Skip) om verder te zoeken. Vinden jullie elkaar allebei leuk? Dan ontstaat er een connectie en kun je chatten.",
  },
  {
    q: "Wat kost een Premium of Elite abonnement?",
    a: "Basis is gratis. Premium kost €4,99 per maand en Elite €9,99 per maand. Je kunt op elk moment upgraden via Menu > Premium & Elite.",
  },
  {
    q: "Wordt mijn exacte adres gedeeld?",
    a: "Nee, we gebruiken alleen je algemene locatie om sportmaatjes in de buurt te vinden. Je exacte adres wordt nooit gedeeld.",
  },
  {
    q: "Hoe verwijder ik mijn account?",
    a: "Ga naar Instellingen > E-mail wijzigen om je gegevens te beheren, of neem contact op met klantenservice om je account te laten verwijderen.",
  },
];

type Props = NativeStackScreenProps<RootStackParamList, "Faq">;

export default function FaqScreen(_props: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Veelgestelde vragen" />
      <ScrollView contentContainerStyle={styles.content}>
        {faqs.map((item, index) => {
          const open = openIndex === index;
          return (
            <Pressable
              key={item.q}
              style={styles.card}
              onPress={() => setOpenIndex(open ? null : index)}
            >
              <View style={styles.questionRow}>
                <Text style={styles.question}>{item.q}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </View>
              {open ? <Text style={styles.answer}>{item.a}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  question: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  answer: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
