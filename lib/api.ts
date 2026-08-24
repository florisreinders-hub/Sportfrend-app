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
      case "23514": {
        // check_violation - profiles_birthdate_min_age_check
        // (0015_profiles_min_age_check.sql) is the one a client can
        // realistically trigger directly (RegisterDetailsScreen already
        // validates this client-side, but a modified/malicious client
        // could skip straight to the insert/upsert - the database is the
        // actual enforcement boundary, this is just a friendly message
        // for it). Other check constraints (level, gender, plan/status,
        // ...) fall through to the generic message below.
        const message = (error as { message?: string }).message ?? "";
        if (message.includes("profiles_birthdate_min_age_check")) {
          return "Je moet minimaal 18 jaar zijn om je te registreren.";
        }
        return "Deze gegevens voldoen niet aan de vereisten.";
      }
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
  search_radius_km: number | null;
  avatar_url: string | null;
  photo_url: string | null;
};

/**
 * Every profiles column the app is allowed to read, deliberately excluding
 * expo_push_token (see 0013_rls_security_audit_fixes.sql) and latitude/
 * longitude (see 0014_discover_profiles_location_privacy.sql) - both are
 * revoked at the column-privilege level for the `authenticated` role, so
 * every profiles query in this file and the app's screens must use this
 * column list (or a subset of it) instead of "*", including for a user's
 * own row (column grants are role-wide, not row-aware - RLS alone can't
 * express "this column, but only on your own row").
 *
 * expo_push_token has no legitimate reader on the client at all (only the
 * push Edge Functions, via the service-role key). latitude/longitude do
 * have one: the profile owner, via get_my_location() (see
 * fetchMyLocation() below) - a SECURITY DEFINER function scoped to
 * auth.uid()'s own row, used instead of a raw column read wherever this
 * app needs someone's own exact coordinates (AuthContext's location
 * check, the "Mijn gegevens opvragen" export). Anyone else's coordinates
 * are never returned raw at all - see fetchDiscoverProfiles(), which gets
 * only a computed distance_km from the discover_profiles() function.
 */
export const PROFILE_COLUMNS =
  "id, full_name, birthdate, gender, bio, sport, level, city, search_radius_km, avatar_url, photo_url, is_onboarded, push_notifications_enabled, profile_visible, availability_days, created_at, updated_at";

/** The calling user's own exact coordinates - see PROFILE_COLUMNS's comment for why this needs a function instead of a plain column read. */
export async function fetchMyLocation(): Promise<{ latitude: number | null; longitude: number | null; city: string | null }> {
  const { data, error } = await supabase.rpc("get_my_location");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { latitude: row?.latitude ?? null, longitude: row?.longitude ?? null, city: row?.city ?? null };
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

export type DiscoverProfile = Profile & { distance_km: number | null };

/**
 * Discover feed: within the selected distance and matching the selected
 * sport/level/age filters (see lib/FilterContext.tsx), excluding the user
 * and anyone they've already swiped on.
 *
 * p_sport and p_distance_km are sent exactly as the Filter screen
 * currently shows them - `filters.sport === null` ("Alle sporten", the
 * screen's permanent default label whether touched or not) means no sport
 * filter, and `filters.distanceKm` is the literal km the slider displays.
 * An earlier version of this function (and of discover_profiles() itself)
 * silently substituted the caller's own profile.sport/search_radius_km
 * whenever a filter was left at its default instead - which meant the
 * screen could say "Alle sporten" / "150KM" while the query actually
 * narrowed to the caller's own sport and a stale 25km default, hiding
 * results (including freshly seeded test profiles) with no visible reason
 * why. See 0016_discover_profiles_no_implicit_defaults.sql for the fix.
 *
 * Only maxAge keeps a "left at default = no filter" convention
 * (filters.maxAge at its max, 90, already reads "18-90" on screen, i.e.
 * genuinely no additional narrowing beyond the app's own 18+ minimum) -
 * there's no separate profile-level default it could be confused with.
 *
 * The actual distance computation happens inside the discover_profiles()
 * Postgres function (supabase/migrations/0014_discover_profiles_location_privacy.sql)
 * rather than here, because it requires reading raw coordinates, which
 * this app no longer lets any client (including this one) read for
 * someone else's profile at all - see PROFILE_COLUMNS's comment. The
 * function runs SECURITY DEFINER (so it can read the coordinates
 * internally) but only ever returns a computed distance_km, never the
 * coordinates themselves.
 */
export async function fetchDiscoverProfiles(
  // Kept for call-site stability (HomeScreen passes session.user.id) even
  // though the RPC no longer needs it - discover_profiles() always
  // resolves "who's asking" from auth.uid() server-side, not a parameter,
  // so the caller can't query distances relative to someone else's
  // location by passing a different id here.
  currentUserId: string,
  filters: DiscoverFilters = DEFAULT_FILTERS
): Promise<DiscoverProfile[]> {
  const { data, error } = await supabase.rpc("discover_profiles", {
    p_sport: filters.sport,
    p_level: filters.level,
    p_max_age: filters.maxAge < DEFAULT_FILTERS.maxAge ? filters.maxAge : null,
    p_distance_km: filters.distanceKm,
    p_limit: 20,
  });
  if (error) throw error;
  return (data ?? []) as DiscoverProfile[];
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
    .select(
      `id, created_at, user_a_id, user_b_id, user_a:profiles!matches_user_a_id_fkey(${PROFILE_COLUMNS}), user_b:profiles!matches_user_b_id_fkey(${PROFILE_COLUMNS})`
    )
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
    .select(`*, author:profiles!posts_author_id_fkey(${PROFILE_COLUMNS}), post_likes(user_id)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Posts for the Connecties tab: only the caller's own posts plus posts by
 * an author they have an existing match with - never "everyone", unlike
 * fetchPosts() (used by the public Berichten feed). `connections` is
 * whatever fetchConnections(userId) already returned - the Connecties tab
 * always fetches that first anyway, so this reuses it instead of a second
 * round trip to resolve matched author ids.
 *
 * This mirrors the "Posts are readable by their author or a match" RLS
 * policy (0017_posts_match_only.sql) exactly - that policy is the actual
 * enforcement boundary (a hand-crafted API call bypassing this function
 * entirely still can't read a stranger's post), this client-side filter
 * just keeps the query's intent explicit rather than relying solely on
 * rows silently disappearing.
 */
export async function fetchConnectionPosts(
  userId: string,
  connections: Awaited<ReturnType<typeof fetchConnections>>
) {
  const matchedAuthorIds = connections
    .map((c: any) => (c.user_a_id === userId ? c.user_b?.id : c.user_a?.id))
    .filter((id: string | undefined): id is string => Boolean(id));
  const authorIds = [userId, ...matchedAuthorIds];

  const { data, error } = await supabase
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(${PROFILE_COLUMNS}), post_likes(user_id)`)
    .in("author_id", authorIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPostsByAuthor(authorId: string) {
  const { data, error } = await supabase
    .from("posts")
    .select(`*, author:profiles!posts_author_id_fkey(${PROFILE_COLUMNS}), post_likes(user_id)`)
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

/**
 * "Users can delete their own posts" (0001_init.sql) already restricts this
 * to auth.uid() = author_id at the RLS level - PostCard only shows the
 * delete option to a post's own author to begin with, this is the
 * server-side backstop.
 */
export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
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

/**
 * Records a plan chosen on the Pricing screen ahead of the (not yet real)
 * payment flow - status "pending", not "active", so a mere selection is
 * never mistaken for a completed payment. PaymentScreen's own checkout
 * still calls upsertSubscription() with status "active" once it actually
 * "pays".
 */
export async function selectPendingPlan(userId: string, plan: "premium" | "elite", priceCents: number) {
  const { error } = await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, plan, price_cents: priceCents, status: "pending" }, { onConflict: "user_id" });
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

export async function createSupportRequest(userId: string, subject: string, message: string) {
  const { error } = await supabase.from("support_requests").insert({ user_id: userId, subject, message });
  if (error) throw error;
}

/**
 * Triggers the send-support-email Edge Function (supabase/functions/
 * send-support-email) so a Klantenservice submission also lands as an
 * email in the Sportfrend inbox, on top of the support_requests row
 * createSupportRequest() already wrote. Best-effort on top of that row,
 * not a replacement for it - callers should let this fail without
 * blocking the "message received" confirmation, since the message is
 * already safely saved either way.
 */
export async function notifySupportRequest(subject: string, message: string) {
  const { error } = await supabase.functions.invoke("send-support-email", {
    body: { subject, message },
  });
  if (error) throw error;
}

/**
 * Sends the "Mijn gegevens opvragen" export (lib/dataExport.ts) to the
 * caller's own registered e-mail address via the send-data-export-email
 * Edge Function. The function resolves the recipient itself from the
 * caller's JWT (auth.getUser()) rather than trusting a client-supplied
 * address - same reasoning as delete-account not trusting a client-
 * supplied user id.
 */
export async function sendDataExportEmail(text: string) {
  const { error } = await supabase.functions.invoke("send-data-export-email", {
    body: { text },
  });
  if (error) throw error;
}

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: "ongepast_gedrag", label: "Ongepast gedrag" },
  { key: "nepprofiel", label: "Nepprofiel" },
  { key: "spam", label: "Spam" },
  { key: "anders", label: "Anders" },
];

/**
 * Saves a moderation report. `matchId` is only passed when reporting from a
 * chat (ChatDetailScreen) - lets a moderator later find the conversation the
 * report came from, left null for reports filed straight from a profile.
 */
export async function createReport(
  reporterId: string,
  reportedId: string,
  reason: string,
  details?: string,
  matchId?: string
) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: reporterId,
    reported_id: reportedId,
    reason,
    details: details?.trim() || null,
    match_id: matchId ?? null,
  });
  if (error) throw error;
}

/**
 * Blocking is one-directional to record (blocker_id/blocked_id), but its
 * effect is symmetric: the "blocks" RLS policies added on profiles/matches/
 * messages (0012_moderation_reports_blocks.sql) hide the other person from
 * both sides regardless of who blocked whom.
 */
export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("blocks")
    .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) throw error;
}

// The four fetchers below back the "Mijn gegevens opvragen" export
// (lib/dataExport.ts, SettingsScreen -> DataExportScreen) - each is scoped
// to rows RLS already lets this user read about themselves (own swipes,
// own support requests, own filed reports, own blocks), so no service-role
// access is needed to assemble a complete export.

export type OwnSwipe = { swiped_id: string; direction: string; created_at: string; swiped: Profile | null };

export async function fetchOwnSwipes(userId: string): Promise<OwnSwipe[]> {
  const { data, error } = await supabase
    .from("swipes")
    .select(`swiped_id, direction, created_at, swiped:profiles!swipes_swiped_id_fkey(${PROFILE_COLUMNS})`)
    .eq("swiper_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OwnSwipe[];
}

export async function fetchOwnSupportRequests(userId: string) {
  const { data, error } = await supabase
    .from("support_requests")
    .select("subject, message, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type OwnReport = {
  reported_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reported: Profile | null;
};

export async function fetchOwnReports(userId: string): Promise<OwnReport[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(`reported_id, reason, details, status, created_at, reported:profiles!reports_reported_id_fkey(${PROFILE_COLUMNS})`)
    .eq("reporter_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OwnReport[];
}

export type OwnBlock = { blocked_id: string; created_at: string; blocked: Profile | null };

/**
 * `blocked` will come back null for every row here, not just some - once a
 * block exists, the profiles RLS policy hides that profile from *both*
 * sides (see 0013_rls_security_audit_fixes.sql), including from the
 * blocker looking back at who they blocked. The export shows the raw id
 * with a note instead of a name in that case (see formatDataExportText).
 */
export async function fetchOwnBlocks(userId: string): Promise<OwnBlock[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(`blocked_id, created_at, blocked:profiles!blocks_blocked_id_fkey(${PROFILE_COLUMNS})`)
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OwnBlock[];
}
