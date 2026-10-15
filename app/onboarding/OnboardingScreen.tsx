import React, { useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, spacing } from "@/constants/theme";
import {
  ONBOARDING_AVAILABILITY_CTA,
  ONBOARDING_LATER_LABEL,
  ONBOARDING_NEXT_LABEL,
  ONBOARDING_SKIP_LABEL,
  ONBOARDING_SLIDES,
} from "@/constants/onboarding";
import { useAuth } from "@/lib/AuthContext";
import { markOnboardingSeen } from "@/lib/onboarding";

type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

const LAST_INDEX = ONBOARDING_SLIDES.length - 1;

/**
 * Shown once after the first login (right after LocationSetupScreen, see
 * its own continueToApp()) for a new user, and once automatically for an
 * existing user on their first cold start after this feature shipped
 * (RootNavigator's initialRouteName) - both driven by
 * AuthContext.onboardingSeen / lib/onboarding.ts's local, per-user-ID
 * AsyncStorage flag, no database column. Also reachable any time after
 * via Instellingen → "Uitleg bekijken" (SettingsScreen.tsx), which just
 * navigates here again without touching that flag.
 */
export default function OnboardingScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  // Measured via onLayout, not Dimensions.get("window") - matches the
  // ScrollView's actual rendered width (safe-area insets etc. already
  // subtracted by ScreenContainer) so each page lines up exactly with one
  // swipe, on any screen size.
  const [pageWidth, setPageWidth] = useState(0);

  const finish = (destination?: "Availability") => {
    if (userId) markOnboardingSeen(userId);
    if (destination) {
      navigation.reset({ index: 1, routes: [{ name: "Home" }, { name: destination }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    }
  };

  const goNext = () => {
    const next = Math.min(index + 1, LAST_INDEX);
    scrollRef.current?.scrollTo({ x: pageWidth * next, animated: true });
    setIndex(next);
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  };

  const isLast = index === LAST_INDEX;

  return (
    <ScreenContainer withBottomPadding={false}>
      <View style={styles.header}>
        <View style={styles.dots}>
          {ONBOARDING_SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={() => finish()} hitSlop={8}>
          <Text style={styles.skip}>{ONBOARDING_SKIP_LABEL}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={styles.scroll}
      >
        {ONBOARDING_SLIDES.map((slide) => (
          <View key={slide.title} style={[styles.slide, { width: pageWidth || undefined }]}>
            <Ionicons name={slide.icon as any} size={72} color={colors.primary} />
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {isLast ? (
          <>
            <Button
              label={ONBOARDING_AVAILABILITY_CTA}
              onPress={() => finish("Availability")}
              style={styles.cta}
            />
            <Button label={ONBOARDING_LATER_LABEL} onPress={() => finish()} variant="outline" style={styles.cta} />
          </>
        ) : (
          <Button label={ONBOARDING_NEXT_LABEL} onPress={goNext} style={styles.cta} />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    minHeight: 44,
  },
  dots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  skip: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.black,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  footer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  cta: {
    width: "100%",
  },
});
