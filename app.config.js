// Converted from app.json to a dynamic config (needed to read SENTRY_DSN
// from the environment at config-eval time and expose it to the app via
// `extra` - a plain app.json can't read process.env). Every other field
// below is an unchanged, verbatim copy of the old app.json.
//
// Sentry's own Expo config plugin ("@sentry/react-native" in `plugins`
// below) deliberately does NOT take an authToken prop here - passing one
// would ship it inside the app config bundle/package, which is exactly
// what Sentry's own plugin warns against. Its native build-phase source
// map upload (wired into the Xcode/Gradle build automatically by this
// plugin - this project's actual "EAS Build hook" for source maps, see
// README.md's "Sentry crash-reporting" section) instead reads
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN/SENTRY_URL straight from the
// EAS Build environment (set as EAS secrets), the same convention
// sentry-cli uses everywhere else.
module.exports = {
  expo: {
    name: "Sportfrend",
    slug: "sportfrend-app",
    version: "1.0.0",
    privacy: "public",
    scheme: "sportfrend",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.sportfrend.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Sportfrend gebruikt je locatie om sportmaatjes in de buurt te vinden.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      package: "com.sportfrend.app",
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Sportfrend gebruikt je locatie om sportmaatjes in de buurt te vinden.",
        },
      ],
      "expo-notifications",
      "expo-font",
      "expo-status-bar",
      "@sentry/react-native",
      // Safe to keep in every profile, not just eas.json's "development"
      // one - eas.json's own `developmentClient` flag (not this plugin's
      // presence) is what actually turns the dev-launcher/dev-menu native
      // code on or off per build profile, same as Expo's own docs set it
      // up. Needed so `eas build --profile development` (see README.md's
      // "Sentry crash-reporting" section) produces an installable
      // dev-client APK at all - without this dependency, a
      // `developmentClient: true` build fails.
      "expo-dev-client",
    ],
    extra: {
      eas: {
        projectId: "f5b98495-a6cb-429f-89e3-6ffd2e522e23",
      },
      // Read here (build/config-eval time, Node.js) rather than as
      // EXPO_PUBLIC_SENTRY_DSN (Metro-inlined at bundle time) because the
      // env var is already named plain SENTRY_DSN - see lib/sentry.ts,
      // which reads this back via Constants.expoConfig.extra.sentryDsn.
      // A DSN is a public identifier (a write-only endpoint, like a
      // Segment/Mixpanel write key), not a secret - safe to ship in the
      // bundle, unlike SENTRY_AUTH_TOKEN above. "" (not null) when unset -
      // `expo config --json` was observed serializing a literal `null`
      // extra value as `{}` instead, which lib/sentry.ts's falsy check
      // would then miss.
      sentryDsn: process.env.SENTRY_DSN ?? "",
    },
    owner: "sportfrendofficial",
    runtimeVersion: {
      policy: "sdkVersion",
    },
    updates: {
      url: "https://u.expo.dev/f5b98495-a6cb-429f-89e3-6ffd2e522e23",
    },
  },
};
