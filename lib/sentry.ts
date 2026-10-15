import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

/**
 * Read from app.config.js's `extra.sentryDsn` (itself read from the
 * SENTRY_DSN environment variable at config-eval time), not directly via
 * `process.env` here - SENTRY_DSN is deliberately not prefixed
 * EXPO_PUBLIC_, so Metro never inlines it into the bundle the way it does
 * EXPO_PUBLIC_SUPABASE_URL/EXPO_PUBLIC_SUPABASE_ANON_KEY (lib/supabase.ts).
 * A DSN isn't a secret (it's a write-only endpoint identifier), so this is
 * still safe to ship in the bundle via `extra` - see app.config.js's
 * comment on this same field for the "why not EXPO_PUBLIC_" reasoning.
 */
const dsn = (Constants.expoConfig?.extra?.sentryDsn as string | undefined) || "";

export const isSentryConfigured = Boolean(dsn);

/**
 * Call once, as early as possible in App.tsx (before anything else can
 * throw) - initializes crash/error reporting for the whole app.
 * `Sentry.init()`'s default integrations already install a global
 * `ErrorUtils` handler (uncaught JS exceptions) and unhandled
 * promise-rejection tracking on their own - no extra wiring needed for
 * those beyond calling this. `ErrorBoundary.tsx`'s own
 * `Sentry.captureException()` call (componentDidCatch) is what covers
 * render-phase errors instead, since those never reach `ErrorUtils`.
 *
 * Fails open like the rest of this app's optional-config handling
 * (isSupabaseConfigured, lib/supabase.ts): a missing DSN (e.g. local dev
 * without a .env) logs a warning and skips init, rather than crashing the
 * app at startup.
 */
export function initSentry() {
  if (!isSentryConfigured) {
    console.warn(
      "[Sentry] SENTRY_DSN ontbreekt - crash-reporting staat uit voor deze sessie. Zie .env.example en README.md's \"Sentry crash-reporting\"-sectie."
    );
    return;
  }

  const slug = Constants.expoConfig?.slug ?? "sportfrend-app";
  const version = Constants.expoConfig?.version ?? "0.0.0";

  Sentry.init({
    dsn,
    // Release/dist split, per Sentry's own recommended pattern for an
    // OTA-updated app: `release` groups by app-store version (stable
    // across every `eas update` push within that version), `dist`
    // distinguishes the specific underlying JS bundle *within* that
    // release. Updates.updateId is a fresh UUID per `eas update` publish -
    // exactly the "release-tracking per build" this needs, given this
    // project ships almost entirely via `eas update`, not fresh native
    // `eas build`s. Falls back to "dev" for a locally-run/embedded bundle
    // (Metro dev server, or a dev/preview build that hasn't fetched an
    // OTA update yet), where there's no updateId at all.
    release: `${slug}@${version}`,
    dist: Updates.updateId ?? "dev",
    // Updates.channel is null in Expo Go / a dev-client run (see
    // expo-updates' own doc comment on the field) - eas.json's three
    // channels (development/preview/production) already line up with
    // Sentry's own `environment` concept, so reuse them directly instead
    // of inventing separate naming.
    environment: Updates.channel || (__DEV__ ? "development" : "production"),
    // Crash/error reporting only, as requested - not performance tracing
    // (Sentry's tracesSampleRate), which is a separate product surface
    // with its own quota on the free tier and wasn't asked for here.
    enableAutoSessionTracking: true,
    debug: __DEV__,
  });

  Sentry.setContext("expo", {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId,
    channel: Updates.channel,
  });
}
