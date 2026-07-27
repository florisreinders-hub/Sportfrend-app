import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";

const logoFull = require("@/assets/logo-full.png");

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.hero}>
        <Image source={logoFull} style={styles.logo} resizeMode="contain" />
      </View>
      <View style={styles.form}>
        <Button label="Volgende" onPress={() => navigation.navigate("RegisterDetails")} style={styles.cta} />
        <Text style={styles.link} onPress={() => navigation.navigate("Login")}>
          Al een account? Log in
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    marginTop: spacing.xxl,
  },
  logo: {
    width: 260,
    height: 230,
  },
  form: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  cta: {
    alignSelf: "center",
    width: 160,
    marginTop: spacing.md,
  },
  link: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
