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

export async function fetchDiscoverProfiles(excludeId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .neq("id", excludeId)
    .limit(20);
  if (error) throw error;
  return data ?? [];
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
