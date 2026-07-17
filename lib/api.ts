import { supabase } from "./supabase";
import { DEFAULT_FILTERS, DiscoverFilters } from "./FilterContext";

/**
 * Translates Postgrest/Postgres error codes into clear Dutch messages.
 * PGRST205/42P01 ("Could not find the table ... in the schema cache") means
 * the SQL migration (supabase/migrations/0001_init.sql) was never actually
 * run against this Supabase project - surface that explicitly instead of
 * the raw schema-cache error or a silent empty list.
 *
 * Note: supabase-js only wraps `error` in an actual `PostgrestError` class
 * instance when `.throwOnError()` was called on the query - nothing in this
 * app does that, so every `.insert()`/`.update()`/`.select()` etc. call
 * resolves `{ data, error }` with `error` as a plain object instead (either
 * PostgREST's parsed JSON error body, or a constructed
 * `{ message, details, hint, code }` for a network failure). An
 * `instanceof PostgrestError` check is therefore never true here and always
 * fell through to the generic message below, no matter what actually went
 * wrong - check the object's shape instead of its class.
 */
export function getDataErrorMessage(error: unknown): string {
  if (error) console.error("[Supabase data error]", error);
  if (!error) return "Er is iets misgegaan. Probeer het opnieuw.";

  if (typeof error === "object" && ("code" in error || "message" in error)) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case "PGRST205":
      case "42P01":
        return "De database is nog niet volledig ingericht: de benodigde tabel bestaat niet. Voer de SQL-migratie (supabase/migrations/0001_init.sql) uit via de Supabase SQL editor of CLI.";
      case "42501":
      case "PGRST301":
        return "Je hebt geen toegang tot deze gegevens. Log opnieuw in en probeer het nogmaals.";
      default: {
        const message = (error as { message?: string }).message;
        if (message) return message;
      }
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

/** Age in whole years from a `profiles.birthdate` ISO date string, or null if unset. */
export function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
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
    .not("id", "in", `(${excludedIds.join(",")})`)
    // Respects the "Profiel zichtbaar voor anderen" privacy toggle
    // (Instellingen-scherm) - someone who turned it off is simply never
    // offered in anyone else's Ontdekken feed.
    .eq("profile_visible", true);

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

/** The matches.id for an existing match between two users, or null if they're not matched. */
export async function findMatchBetween(userAId: string, userBId: string): Promise<string | null> {
  const [userA, userB] = [userAId, userBId].sort();
  const { data, error } = await supabase
    .from("matches")
    .select("id")
    .eq("user_a_id", userA)
    .eq("user_b_id", userB)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function deleteMatch(matchId: string) {
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) throw error;
}

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function fetchMessages(matchId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(matchId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_id: matchId, sender_id: senderId, body })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export type Conversation = {
  id: string;
  created_at: string;
  otherUser: Profile | null;
  lastMessage: Message | null;
};

/**
 * One row per match, enriched with the other participant's profile and the
 * most recent message (if any), sorted by that message's timestamp (or the
 * match's own created_at when nobody has said anything yet) - newest first,
 * same ordering convention as a normal chat app's conversation list.
 */
export async function fetchConversations(userId: string): Promise<Conversation[]> {
  const matches = await fetchConnections(userId);
  if (matches.length === 0) return [];

  const matchIds = matches.map((m) => m.id);
  const { data: recentMessages, error } = await supabase
    .from("messages")
    .select("*")
    .in("match_id", matchIds)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const lastMessageByMatch = new Map<string, Message>();
  for (const message of recentMessages ?? []) {
    if (!lastMessageByMatch.has(message.match_id)) {
      lastMessageByMatch.set(message.match_id, message as Message);
    }
  }

  return matches
    .map((match) => ({
      id: match.id,
      created_at: match.created_at,
      otherUser: (match.user_a_id === userId ? match.user_b : match.user_a) as unknown as Profile | null,
      lastMessage: lastMessageByMatch.get(match.id) ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.lastMessage?.created_at ?? a.created_at;
      const bTime = b.lastMessage?.created_at ?? b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
}

const WEEKDAYS_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];

/** Compact chat-list timestamp: "14:32" today, "Gisteren", weekday within a week, else "DD-MM-JJJJ". */
export function formatConversationTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff === 0) return date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (dayDiff === 1) return "Gisteren";
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAYS_NL[date.getDay()];
  return date.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// posts has exactly one direct foreign key to profiles (author_id), but
// PostgREST's relationship detection also treats post_likes as an implicit
// bridge between posts and profiles - it has its own FKs to both
// (post_id -> posts, user_id -> profiles), which reads as a second,
// indirect many-to-many-style path connecting the two. Embedding both
// `profiles` and `post_likes` in the same posts query is therefore
// ambiguous ("Could not embed because more than one relationship was
// found for 'posts' and 'profiles'") unless the profiles embed names its
// exact constraint - posts_author_id_fkey is Postgres's default-generated
// name for `author_id ... references public.profiles (id)` in
// 0001_init.sql (no explicit `constraint` clause there), the same pattern
// already used for matches.user_a/user_b below.
export async function fetchPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(*), post_likes(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPostsByAuthor(authorId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(*), post_likes(user_id)")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type NewPostFields = {
  imageUrl?: string | null;
  sport?: string | null;
  eventDate?: string | null;
};

// Only sport/event_date/image_url are sent, all optional. image_url and
// event_date have been in the posts table since the very first migration;
// sport, event_time and location were all added together in a later
// migration (0002) that turned out to not reliably reach every project's
// live database - that's what caused "Could not find the 'event_time'
// column of 'posts' in the schema cache": keying an insert on a column
// that isn't guaranteed to exist fails unconditionally, on every single
// post, regardless of whether that particular field had a real value.
// event_time and location are dropped here rather than re-chased (date is
// the only "wanneer" field wanted now anyway, no time-of-day); sport stays
// since it's still wanted, backed by migration 0003 instead.
export async function createPost(authorId: string, body: string, fields: NewPostFields = {}) {
  const { error } = await supabase.from("posts").insert({
    author_id: authorId,
    body,
    image_url: fields.imageUrl ?? null,
    sport: fields.sport ?? null,
    event_date: fields.eventDate ?? null,
  });
  if (error) throw error;
}

const MONTHS_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** "18 jul" for a post's event_date, or null if unset. */
export function formatEventDateTime(eventDate: string | null | undefined): string | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return `${day} ${MONTHS_NL[month - 1]}`;
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

export const WEEKDAY_OPTIONS: { key: string; label: string }[] = [
  { key: "ma", label: "Ma" },
  { key: "di", label: "Di" },
  { key: "wo", label: "Wo" },
  { key: "do", label: "Do" },
  { key: "vr", label: "Vr" },
  { key: "za", label: "Za" },
  { key: "zo", label: "Zo" },
];

export type ProfileSettings = {
  push_notifications_enabled: boolean;
  profile_visible: boolean;
  availability_days: string[];
};

export async function fetchProfileSettings(userId: string): Promise<ProfileSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select("push_notifications_enabled, profile_visible, availability_days")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    push_notifications_enabled: data?.push_notifications_enabled ?? true,
    profile_visible: data?.profile_visible ?? true,
    availability_days: data?.availability_days ?? [],
  };
}

/**
 * upsert (not update): same reasoning as LocationSetupScreen's save - a
 * profile row might not exist yet for this user for whatever reason, and
 * .update().eq("id", userId) silently matches zero rows and "succeeds"
 * without writing anything in that case, rather than erroring.
 */
export async function updateProfileSettings(userId: string, fields: Partial<ProfileSettings>) {
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...fields }, { onConflict: "id" });
  if (error) throw error;
}
