import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts, RubikMonoOne_400Regular } from "@expo-google-fonts/rubik-mono-one";
import { Ruluko_400Regular } from "@expo-google-fonts/ruluko";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "@/navigation/RootNavigator";
import { AuthProvider } from "@/lib/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { isSupabaseConfigured } from "@/lib/supabase";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    RubikMonoOne_400Regular,
    Ruluko_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (fontError) {
    console.warn("Fonts konden niet geladen worden, val terug op systeemfont:", fontError);
  }

  // Proceed once fonts have either loaded or definitively failed, so a broken
  // font file can never leave the app stuck on the loading spinner forever.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!isSupabaseConfigured ? (
          <View style={styles.configBanner}>
            <Text style={styles.configBannerText}>
              Supabase is niet geconfigureerd. Kopieer .env.example naar .env en vul je project-URL en anon key in.
            </Text>
          </View>
        ) : null}
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  configBanner: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  configBannerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.white,
    textAlign: "center",
  },
});
