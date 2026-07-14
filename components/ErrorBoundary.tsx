import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

// Without this, an uncaught render error anywhere below results in a blank
// white screen with no visible feedback, especially in a published/preview
// build where the dev-only LogBox overlay isn't available.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Onverwachte fout in de app:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Er ging iets mis</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: colors.danger,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
