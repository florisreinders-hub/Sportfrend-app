import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/types";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { SwipeCard } from "@/components/SwipeCard";
import { Button } from "@/components/Button";
import { colors, fonts, fontSizes, radii, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/AuthContext";
import { fetchConnections, fetchDiscoverProfiles, getDataErrorMessage, recordSwipe, Profile } from "@/lib/api";
import { avatarPlaceholder } from "@/constants/placeholders";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation, route }: Props) {
  const { session } = useAuth();
  const [tab, setTab] = useState<"ontdekken" | "connecties">(route.params?.tab ?? "ontdekken");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiscover = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDiscoverProfiles(session.user.id);
      setProfiles(data);
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  const loadConnections = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConnections(session.user.id);
      setConnections(data);
    } catch (e) {
      setError(getDataErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [session?.user]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "ontdekken") loadDiscover();
      else loadConnections();
    }, [tab, loadDiscover, loadConnections])
  );

  const handleSwipe = async (profile: Profile, direction: "like" | "skip") => {
    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    if (!session?.user) return;
    try {
      const result = await recordSwipe(session.user.id, profile.id, direction);
      if (result.matched) {
        navigation.navigate("Match", {
          matchId: result.matchId,
          matchedName: profile.full_name ?? "Sportmaatje",
          matchedPhoto: profile.photo_url ?? avatarPlaceholder(profile.id),
        });
      }
    } catch (e) {
      // swallow: swipe already recorded locally, backend can reconcile on next load
    }
  };

  return (
    <ScreenContainer withBottomPadding={false}>
      <TopBar />

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab("ontdekken")}
          style={[styles.tab, tab === "ontdekken" && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, tab === "ontdekken" && styles.tabLabelActive]}>Ontdekken</Text>
        </Pressable>
        <Pressable onPress={() => setTab("connecties")} style={styles.tab}>
          <Text style={styles.tabLabel}>Connecties</Text>
        </Pressable>
      </View>

      {tab === "ontdekken" ? (
        <View style={styles.deckArea}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : profiles.length === 0 ? (
            <Text style={styles.empty}>Geen sporters gevonden. Pas je filters aan of kom later terug.</Text>
          ) : (
            <>
              <View style={styles.cardStack}>
                {profiles
                  .slice(0, 3)
                  .reverse()
                  .map((profile, index, arr) => (
                    <SwipeCard
                      key={profile.id}
                      profile={profile}
                      isTop={index === arr.length - 1}
                      onSwiped={(direction) => handleSwipe(profile, direction)}
                    />
                  ))}
              </View>
              <View style={styles.actionRow}>
                <Button
                  label="Skip"
                  variant="danger"
                  style={styles.actionButton}
                  onPress={() => handleSwipe(profiles[profiles.length - 1], "skip")}
                />
                <Button
                  label="Connect"
                  variant="primary"
                  style={styles.actionButton}
                  onPress={() => handleSwipe(profiles[profiles.length - 1], "like")}
                />
              </View>
            </>
          )}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.connectionsList}
          data={connections}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : error ? (
              <Text style={styles.empty}>{error}</Text>
            ) : (
              <Text style={styles.empty}>Nog geen connecties. Swipe rechts om te connecten!</Text>
            )
          }
          renderItem={({ item }) => {
            const other = item.user_a_id === session?.user?.id ? item.user_b : item.user_a;
            return (
              <Pressable
                style={styles.connectionRow}
                onPress={() =>
                  navigation.navigate("ChatDetail", {
                    chatId: item.id,
                    name: other?.full_name ?? "Sportmaatje",
                    photo: other?.photo_url ?? avatarPlaceholder(other?.id ?? item.id),
                  })
                }
              >
                <Image source={{ uri: other?.photo_url ?? avatarPlaceholder(other?.id ?? item.id) }} style={styles.avatar} />
                <View>
                  <Text style={styles.connectionName}>{other?.full_name ?? "Sportmaatje"}</Text>
                  <Text style={styles.connectionMeta}>{other?.sport ?? "Sport onbekend"}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <BottomNav active="home" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  tabLabel: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xs,
    color: colors.black,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  deckArea: {
    flex: 1,
    alignItems: "center",
  },
  cardStack: {
    flex: 1,
    width: "100%",
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  connectionsList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  connectionName: {
    fontFamily: fonts.accent,
    fontSize: fontSizes.md,
    color: colors.black,
  },
  connectionMeta: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
});
