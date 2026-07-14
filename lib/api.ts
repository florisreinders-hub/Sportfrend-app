import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { DEFAULT_FILTERS, DiscoverFilters } from "./FilterContext";

/**
 * Translates Postgrest/Postgres error codes into clear Dutch messages.
 * PGRST205/42P01 ("Could not find the table ... in the schema cache") means
 * the SQL migration (supabase/migrations/0001_init.sql) was never actually
 * run against this Supabase project - surface that explicitly instead of
 * the raw schema-cache error or a silent empty list.
 */
export function getDataErrorMessage(error: unknown): string {
  if (!error) return "Er is iets misgegaan. Probeer het opnieuw.";

  if (error instanceof PostgrestError) {
    switch (error.code) {
      case "PGRST205":
      case "42P01":
        return "De database is nog niet volledig ingericht: de benodigde tabel bestaat niet. Voer de SQL-migratie (supabase/migrations/0001_init.sql) uit via de Supabase SQL editor of CLI.";
      case "42501":
      case "PGRST301":
        return "Je hebt geen toegang tot deze gegevens. Log opnieuw in en probeer het nogmaals.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) return error.message;
  return "Er is iets misgegaan. Probeer het opnieuw.";
}

export type Profile = {
  id: string;
  full_name: string | null;
  birthdate: string | null;
  gender: string | null;
  bio: string | null;
  sport: string | null;
  level: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  search_radius_km: number | null;
  avatar_url: string | null;
  photo_url: string | null;
};

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "DD-MM-JJJJ"-free ISO date for someone who is exactly `age` years old today. */
function isoDateForAge(age: number): string {
  const today = new Date();
  const d = new Date(today.getFullYear() - age, today.getMonth(), today.getDate());
  return d.toISOString().slice(0, 10);
}

/**
 * Discover feed: same sport as the current user (when set) and within their
 * search radius (when they have a location set), excluding the user and
 * anyone they've already swiped on. Both filters degrade gracefully - a
 * user who skipped location setup or hasn't picked a sport yet still sees
 * a feed, just without that particular narrowing.
 *
 * `filters` (set on the Filter screen, see lib/FilterContext.tsx) layer on
 * top of / override those profile-based defaults: an explicit sport/level
 * choice takes precedence over the profile's own sport, a narrowed distance
 * overrides the profile's search_radius_km, and an age ceiling below the
 * default (90) adds a birthdate range. Left-at-default filter values are
 * treated as "not set" so a user who never opens the Filter screen still
 * gets the same profile-based feed as before.
 */
export async function fetchDiscoverProfiles(
  currentUserId: string,
  filters: DiscoverFilters = DEFAULT_FILTERS
): Promise<Profile[]> {
  const { data: ownProfile, error: ownProfileError } = await supabase
    .from("profiles")
    .select("sport, latitude, longitude, search_radius_km")
    .eq("id", currentUserId)
    .maybeSingle();
  if (ownProfileError) throw ownProfileError;

  const { data: swiped, error: swipedError } = await supabase
    .from("swipes")
    .select("swiped_id")
    .eq("swiper_id", currentUserId);
  if (swipedError) throw swipedError;

  const excludedIds = [currentUserId, ...(swiped ?? []).map((s) => s.swiped_id)];

  let query = supabase
    .from("profiles")
    .select("*")
    .not("id", "in", `(${excludedIds.join(",")})`);

  const sportFilter = filters.sport ?? ownProfile?.sport;
  if (sportFilter) {
    query = query.eq("sport", sportFilter);
  }

  if (filters.level) {
    query = query.eq("level", filters.level);
  }

  if (filters.maxAge < DEFAULT_FILTERS.maxAge) {
    // Youngest allowed (18) sets the upper birthdate bound, oldest allowed
    // (filters.maxAge) sets the lower one.
    query = query.gte("birthdate", isoDateForAge(filters.maxAge)).lte("birthdate", isoDateForAge(18));
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  let results = (data ?? []) as Profile[];

  const radiusKm = filters.distanceKm < DEFAULT_FILTERS.distanceKm ? filters.distanceKm : ownProfile?.search_radius_km;
  if (ownProfile?.latitude != null && ownProfile?.longitude != null && radiusKm != null) {
    const ownLat = ownProfile.latitude;
    const ownLng = ownProfile.longitude;
    results = results
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => ({ profile: p, distanceKm: haversineDistanceKm(ownLat, ownLng, p.latitude!, p.longitude!) }))
      .filter(({ distanceKm }) => distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .map(({ profile }) => profile);
  }

  return results.slice(0, 20);
}

export type SwipeResult = { matched: false } | { matched: true; matchId: string };

export async function recordSwipe(swiperId: string, swipedId: string, direction: "like" | "skip"): Promise<SwipeResult> {
  const { error } = await supabase
    .from("swipes")
    .upsert({ swiper_id: swiperId, swiped_id: swipedId, direction }, { onConflict: "swiper_id,swiped_id" });
  if (error) throw error;

  if (direction !== "like") return { matched: false };

  const { data: reciprocal } = await supabase
    .from("swipes")
    .select("id")
    .eq("swiper_id", swipedId)
    .eq("swiped_id", swiperId)
    .eq("direction", "like")
    .maybeSingle();

  if (!reciprocal) return { matched: false };

  const [userA, userB] = [swiperId, swipedId].sort();
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: "user_a_id,user_b_id" })
    .select("id")
    .single();
  if (matchError) throw matchError;

  return { matched: true, matchId: match.id };
}

export async function fetchConnections(userId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("id, created_at, user_a_id, user_b_id, user_a:profiles!matches_user_a_id_fkey(*), user_b:profiles!matches_user_b_id_fkey(*)")
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMessages(matchId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(matchId: string, senderId: string, body: string) {
  const { error } = await supabase.from("messages").insert({ match_id: matchId, sender_id: senderId, body });
  if (error) throw error;
}

export async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles(*), post_likes(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPost(authorId: string, body: string, imageUrl?: string, eventDate?: string) {
  const { error } = await supabase
    .from("posts")
    .insert({ author_id: authorId, body, image_url: imageUrl ?? null, event_date: eventDate ?? null });
  if (error) throw error;
}

export async function toggleLike(postId: string, userId: string, liked: boolean) {
  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function fetchSubscription(userId: string) {
  const { data, error } = await supabase.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertSubscription(userId: string, plan: "basis" | "premium" | "elite", priceCents: number) {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, plan, price_cents: priceCents, status: "active" }, { onConflict: "user_id" });
  if (error) throw error;
}
