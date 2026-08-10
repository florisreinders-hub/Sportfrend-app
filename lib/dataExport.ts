import { supabase } from "./supabase";
import {
  fetchConnections,
  fetchMessages,
  fetchOwnBlocks,
  fetchOwnReports,
  fetchOwnSupportRequests,
  fetchOwnSwipes,
  fetchPostsByAuthor,
  fetchSubscription,
  Message,
  OwnBlock,
  OwnReport,
  OwnSwipe,
  PROFILE_COLUMNS,
  Profile,
} from "./api";

/**
 * "Mijn gegevens opvragen" (recht op inzage/dataportabiliteit, AVG) -
 * assembles everything DATA_INVENTORY.md documents as personal data tied to
 * this account, using the exact same RLS-scoped queries the rest of the app
 * already uses to read a user's own rows. No service-role access needed:
 * RLS already restricts every one of these tables to "this user's own
 * data" for the querying user (see 0001_init.sql's policies), which is
 * exactly the scope a self-service export needs.
 */

export type DataExportMatch = {
  id: string;
  created_at: string;
  otherUser: Profile | null;
  messages: Message[];
};

export type DataExportResult = {
  profile: Profile | null;
  matches: DataExportMatch[];
  posts: any[];
  swipes: OwnSwipe[];
  subscription: Awaited<ReturnType<typeof fetchSubscription>>;
  supportRequests: Awaited<ReturnType<typeof fetchOwnSupportRequests>>;
  reports: OwnReport[];
  blocks: OwnBlock[];
};

export async function fetchDataExport(userId: string): Promise<DataExportResult> {
  const [profileResult, connections, posts, swipes, subscription, supportRequests, reports, blocks] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
    fetchConnections(userId),
    fetchPostsByAuthor(userId),
    fetchOwnSwipes(userId),
    fetchSubscription(userId),
    fetchOwnSupportRequests(userId),
    fetchOwnReports(userId),
    fetchOwnBlocks(userId),
  ]);
  if (profileResult.error) throw profileResult.error;

  const matches: DataExportMatch[] = await Promise.all(
    connections.map(async (match: any) => ({
      id: match.id,
      created_at: match.created_at,
      otherUser: (match.user_a_id === userId ? match.user_b : match.user_a) as Profile | null,
      messages: await fetchMessages(match.id),
    }))
  );

  return {
    profile: profileResult.data as Profile | null,
    matches,
    posts,
    swipes,
    subscription,
    supportRequests,
    reports,
    blocks,
  };
}

const dateFmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("nl-NL") : "-");
const dateOnlyFmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("nl-NL") : "-");

/** Plain text - used both for the in-app view (DataExportScreen) and as the export e-mail's body. */
export function formatDataExportText(data: DataExportResult, userId: string, userEmail: string): string {
  const lines: string[] = [];
  const p = data.profile;

  lines.push("SPORTFREND - OVERZICHT VAN JE GEGEVENS");
  lines.push(`Aangevraagd op: ${new Date().toLocaleString("nl-NL")}`);
  lines.push(`E-mailadres van je account: ${userEmail}`);
  lines.push("");

  lines.push("=== PROFIEL ===");
  if (p) {
    lines.push(`Naam: ${p.full_name ?? "-"}`);
    lines.push(`Geboortedatum: ${p.birthdate ?? "-"}`);
    lines.push(`Geslacht: ${p.gender ?? "-"}`);
    lines.push(`Sport: ${p.sport ?? "-"}`);
    lines.push(`Niveau: ${p.level ?? "-"}`);
    lines.push(`Bio: ${p.bio ?? "-"}`);
    lines.push(`Stad: ${p.city ?? "-"}`);
    lines.push(`Locatiecoördinaten: ${p.latitude ?? "-"}, ${p.longitude ?? "-"}`);
    lines.push(`Zoekstraal: ${p.search_radius_km ?? "-"} km`);
    lines.push(`Profielfoto-URL: ${p.photo_url ?? "-"}`);
    lines.push(`Profiel zichtbaar in Ontdekken: ${(p as any).profile_visible === false ? "Nee" : "Ja"}`);
    lines.push(`Pushmeldingen aan: ${(p as any).push_notifications_enabled === false ? "Nee" : "Ja"}`);
  } else {
    lines.push("Geen profielgegevens gevonden.");
  }
  lines.push("");

  lines.push(`=== MATCHES EN BERICHTEN (${data.matches.length}) ===`);
  if (data.matches.length === 0) {
    lines.push("Geen matches.");
  }
  data.matches.forEach((m) => {
    lines.push(`- Match met ${m.otherUser?.full_name ?? "onbekende gebruiker"} (sinds ${dateOnlyFmt(m.created_at)})`);
    if (m.messages.length === 0) {
      lines.push("  Geen berichten in dit gesprek.");
    } else {
      m.messages.forEach((msg) => {
        const who = msg.sender_id === userId ? "Jij" : m.otherUser?.full_name ?? "Zij/hij";
        lines.push(`  [${dateFmt(msg.created_at)}] ${who}: ${msg.body}`);
      });
    }
  });
  lines.push("");

  lines.push(`=== POSTS (${data.posts.length}) ===`);
  if (data.posts.length === 0) {
    lines.push("Geen posts.");
  }
  data.posts.forEach((post: any) => {
    lines.push(`- [${dateFmt(post.created_at)}] ${post.body}`);
    if (post.sport) lines.push(`  Sport: ${post.sport}`);
    if (post.event_date) lines.push(`  Datum: ${post.event_date}`);
    if (post.image_url) lines.push(`  Foto: ${post.image_url}`);
    lines.push(`  Likes: ${post.post_likes?.length ?? 0}`);
  });
  lines.push("");

  lines.push(`=== SWIPES (${data.swipes.length}) ===`);
  if (data.swipes.length === 0) {
    lines.push("Geen swipes.");
  }
  data.swipes.forEach((s) => {
    const label = s.direction === "like" ? "Geliket" : "Geskipt";
    lines.push(`- ${label}: ${s.swiped?.full_name ?? "onbekende gebruiker"} (${dateFmt(s.created_at)})`);
  });
  lines.push("");

  lines.push("=== ABONNEMENT ===");
  if (data.subscription) {
    lines.push(`Plan: ${data.subscription.plan}`);
    lines.push(`Status: ${data.subscription.status}`);
    lines.push(`Prijs: €${(data.subscription.price_cents / 100).toFixed(2)}/maand`);
    lines.push(`Huidige periode eindigt: ${dateFmt(data.subscription.current_period_end)}`);
  } else {
    lines.push("Geen abonnementsgegevens gevonden.");
  }
  lines.push("");

  lines.push(`=== KLANTENSERVICE-AANVRAGEN (${data.supportRequests.length}) ===`);
  if (data.supportRequests.length === 0) {
    lines.push("Geen aanvragen.");
  }
  data.supportRequests.forEach((r) => {
    lines.push(`- [${dateFmt(r.created_at)}] ${r.subject}: ${r.message}`);
  });
  lines.push("");

  lines.push(`=== DOOR JOU INGEDIENDE RAPPORTAGES (${data.reports.length}) ===`);
  if (data.reports.length === 0) {
    lines.push("Geen rapportages.");
  }
  data.reports.forEach((r) => {
    lines.push(`- [${dateFmt(r.created_at)}] Over ${r.reported?.full_name ?? "onbekende gebruiker"}: ${r.reason}${r.details ? ` - ${r.details}` : ""} (status: ${r.status})`);
  });
  lines.push("");

  lines.push(`=== DOOR JOU GEBLOKKEERDE GEBRUIKERS (${data.blocks.length}) ===`);
  if (data.blocks.length === 0) {
    lines.push("Niemand geblokkeerd.");
  }
  data.blocks.forEach((b) => {
    // b.blocked is always null once a block exists - the blocking itself hides
    // that profile from you too (see fetchOwnBlocks's comment in lib/api.ts).
    lines.push(`- Geblokkeerd op ${dateFmt(b.created_at)} (gebruikers-ID ${b.blocked_id} - profiel niet meer zichtbaar na blokkade)`);
  });

  return lines.join("\n");
}
