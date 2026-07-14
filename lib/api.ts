import { supabase } from "./supabase";

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

/**
 * Discover feed: same sport as the current user (when set) and within their
 * search radius (when they have a location set), excluding the user and
 * anyone they've already swiped on. Both filters degrade gracefully - a
 * user who skipped location setup or hasn't picked a sport yet still sees
 * a feed, just without that particular narrowing.
 */
export async function fetchDiscoverProfiles(currentUserId: string): Promise<Profile[]> {
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
  if (ownProfile?.sport) {
    query = query.eq("sport", ownProfile.sport);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  let results = (data ?? []) as Profile[];

  if (ownProfile?.latitude != null && ownProfile?.longitude != null) {
    const radiusKm = ownProfile.search_radius_km ?? 25;
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

export async function recordSwipe(swiperId: string, swipedId: string, direction: "like" | "skip") {
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
  const { error: matchError } = await supabase
    .from("matches")
    .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: "user_a_id,user_b_id" });
  if (matchError) throw matchError;

  return { matched: true };
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
