/**
 * The only client-side copy of the moderator's e-mail address - used
 * purely to hide/show the "Moderatie" entry point in SettingsScreen.tsx
 * and to short-circuit ModerationScreen.tsx's own UI for anyone else. This
 * is NOT the access boundary: the real one is public.is_moderator() in the
 * database (see 0029_moderation_dashboard.sql), which every RLS policy on
 * reports/flagged_content actually checks. A client that skipped this
 * check entirely (a modified app, direct API calls) would still see
 * exactly nothing from those tables - this constant only controls whether
 * a genuine user ever sees the button and the screen's happy path.
 */
export const MODERATOR_EMAIL = "floris.reinders@gmail.com";
