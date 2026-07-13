import React, { useRef } from "react";
import { Animated, Image, PanResponder, StyleSheet, Text, View, Dimensions } from "react-native";
import { fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { Profile } from "@/lib/api";
import { sportPhotoPlaceholder } from "@/constants/placeholders";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

type Props = {
  profile: Profile;
  onSwiped: (direction: "like" | "skip") => void;
  isTop: boolean;
};

export function SwipeCard({ profile, onSwiped, isTop }: Props) {
  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          forceSwipe("like");
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          forceSwipe("skip");
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const forceSwipe = (direction: "like" | "skip") => {
    const x = direction === "like" ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    Animated.timing(position, { toValue: { x, y: 0 }, duration: 250, useNativeDriver: true }).start(() => {
      position.setValue({ x: 0, y: 0 });
      onSwiped(direction);
    });
  };

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-10deg", "0deg", "10deg"],
  });

  const cardStyle = isTop
    ? { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }
    : undefined;

  const age = profile.birthdate
    ? Math.floor((Date.now() - new Date(profile.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : undefined;

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <Image
        source={{ uri: profile.photo_url ?? sportPhotoPlaceholder(profile.id) }}
        style={styles.photo}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Naam:{profile.full_name ?? "Onbekend"}</Text>
        {age ? <Text style={styles.overlayText}>Leeftijd:{age}</Text> : null}
        <Text style={styles.overlayText}>Sport:{profile.sport ?? "-"}</Text>
        <Text style={styles.overlayText}>Locatie:{profile.city ?? "-"}</Text>
        <Text style={styles.overlayText}>Niveau: {profile.level ?? "-"}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 20,
    height: 562,
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: "#ddd",
  },
  photo: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  overlayText: {
    fontFamily: fonts.accent,
    fontSize: fontSizes.lg,
    color: "#fff",
  },
});
