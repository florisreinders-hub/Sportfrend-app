const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// getSentryExpoConfig() wraps Expo's own getDefaultConfig() (no separate
// call to it needed) and adds a Metro serializer that embeds a Debug ID
// into both the output bundle and its source map. That Debug ID - not a
// release/dist string match - is what Sentry actually uses to find the
// right source map for a given crash, which matters a lot here: this
// project ships most changes via `eas update` (OTA), not `eas build`, so
// there's rarely a fresh native build to tie a release string to. See
// README.md's "Sentry crash-reporting" section for the full source-map
// upload story (native EAS Build hook vs. the `eas update` case).
module.exports = getSentryExpoConfig(__dirname);
