import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { DetailHeader } from "@/components/DetailHeader";
import { BottomNav } from "@/components/BottomNav";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Helpdesk">;

const topics = [
  { icon: "person-circle-outline" as const, label: "Problemen met mijn account" },
  { icon: "heart-outline" as const, label: "Matchen en connecties" },
  { icon: "card-outline" as const, label: "Betalingen en abonnementen" },
  { icon: "shield-checkmark-outline" as const, label: "Veiligheid en privacy" },
];

export default function HelpdeskScreen({ navigation }: Props) {
  return (
    <ScreenContainer withBottomPadding={false}>
      <DetailHeader title="Helpdesk" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Waar kunnen we je mee helpen?</Text>

        {topics.map((topic) => (
          <Pressable key={topic.label} style={styles.card} onPress={() => navigation.navigate("Faq")}>
            <Ionicons name={topic.icon} size={22} color={colors.primary} />
            <Text style={styles.cardLabel}>{topic.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Staat je vraag er niet bij?</Text>
          <Pressable onPress={() => navigation.navigate("Support")}>
            <Text style={styles.footerLink}>Neem contact op met klantenservice</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomNav active="menu" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
  },
  intro: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.md,
    color: colors.black,
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  cardLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  footerLink: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
    marginTop: spacing.xs,
  },
});
