import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.hero}>
        <Ionicons name="leaf" size={90} color={colors.primary} />
        <Text style={styles.brand}>Sportmaatje</Text>
      </View>
      <View style={styles.form}>
        <Input placeholder="E-mail" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input placeholder="Wachtwoord" secureTextEntry value={password} onChangeText={setPassword} />
        <Button
          label="Volgende"
          onPress={() => navigation.navigate("RegisterDetails", { email, password })}
          disabled={!email || !password}
          style={styles.cta}
        />
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
  brand: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xxl,
    color: colors.black,
    marginTop: spacing.sm,
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
