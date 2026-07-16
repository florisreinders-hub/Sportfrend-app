# Sportfrend

Nederlandse sportmaatje-matching app, gebouwd met Expo (React Native + TypeScript),
React Navigation en Supabase. De schermen zijn gebouwd op basis van het Sportfrend
Figma-bestand (`yhz6E1ex3WMPl4ieoK6XF0`) met exacte kleuren, fonts en spacing waar
beschikbaar.

## Functionaliteit

- **Onboarding**: inloggen, registreren (2 stappen), wachtwoord vergeten, locatie instellen
- **Ontdekken**: swipe-kaarten om sportmaatjes te vinden (Skip / Connect), met match-scherm
- **Connecties**: overzicht van je matches
- **Filter**: leeftijd, afstand, sport, niveau, beschikbaarheid
- **Profielen**: sporters bekijken, je eigen profiel bekijken en bewerken
- **Berichten**: community-feed ("Bericht plaatsen") en realtime 1-op-1 chat
- **Instellingen**: account, voorkeuren, e-mail wijzigen
- **Premium & Elite**: Basis (gratis), Premium (€4,99/mnd), Elite (€9,99/mnd) + betaalscherm
- **Ondersteuning**: Helpdesk, veelgestelde vragen, klantenservice

Een herbruikbare `BottomNav` (Profiel, Home, Filter, Menu) staat op alle
hoofdschermen, exact zoals in het Figma-ontwerp.

## Mapstructuur

```
/app            Schermen, gegroepeerd per feature (auth, home, profile, chat, settings, premium)
/components     Herbruikbare UI-componenten (BottomNav, TopBar, Button, Input, SwipeCard, ...)
/lib            Supabase client, auth helpers, data-access laag, AuthContext
/constants      Design tokens (theme.ts) en placeholder-afbeeldingen
/navigation     React Navigation stack en route-types
/supabase/migrations  SQL-migraties voor het Supabase project
```

## Vereisten

- Node.js 18+
- Een gratis [Supabase](https://supabase.com) project
- De [Expo Go](https://expo.dev/go) app op je telefoon (iOS/Android), of een simulator

## Lokaal draaien

1. **Installeer dependencies**

   ```bash
   npm install
   ```

2. **Zet je Supabase project op**

   - Maak een nieuw project aan op [supabase.com](https://supabase.com)
   - Open de SQL editor en plak de inhoud van elk bestand in `supabase/migrations/`,
     in bestandsvolgorde (`0001_init.sql`, `0002_...`, `0003_...`, ...)
     (of gebruik `supabase db push` als je de Supabase CLI gebruikt)
   - Ga naar **Project Settings → API** en kopieer de `Project URL` en `anon public` key

3. **Configureer environment variables**

   ```bash
   cp .env.example .env
   ```

   Vul in `.env` de volgende waarden in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=jouw-anon-key
   ```

4. **Zet de auth-redirect URL op de allowlist**

   De app gebruikt het `sportfrend://` custom scheme (`app.json` → `"scheme": "sportfrend"`)
   zodat de bevestigingslink in registratie-/wachtwoord-reset-e-mails rechtstreeks
   terug de app in gaat in plaats van naar een browser/localhost (zie
   `lib/deepLinking.ts`). Een bevestigde registratie toont daarna het
   "E-mailadres bevestigd!"-scherm met een knop naar inloggen.

   `lib/deepLinking.ts`'s `getAuthRedirectUrl()` bouwt deze URL met
   `Linking.createURL("auth/callback")`, wat automatisch het juiste schema
   gebruikt per omgeving:

   | Omgeving                          | Resulterende redirect-URL                |
   | ---------------------------------- | ----------------------------------------- |
   | Standalone / EAS Update build      | `sportfrend://auth/callback`              |
   | Expo Go / dev client (lokaal)      | `exp://<jouw-ip>:8081/--/auth/callback`   |

   Supabase accepteert een `emailRedirectTo`/`redirectTo` **alleen** als die
   op de allowlist staat — de app-configuratie alleen is niet genoeg, dit moet
   je zelf in het Supabase dashboard instellen (hier heeft Claude geen
   toegang toe):

   - Ga naar **Authentication → URL Configuration** in je Supabase dashboard
   - **Site URL**: mag op de standaardwaarde blijven (`http://localhost:3000`)
     — deze wordt alleen gebruikt als fallback wanneer een auth-aanroep géén
     expliciete redirect meegeeft, wat in deze app nergens gebeurt
   - **Redirect URLs**: voeg toe:
     - `sportfrend://**` (verplicht, voor gepubliceerde/standalone builds)
     - `exp://**` (voor lokaal testen via Expo Go/dev client — het IP-adres
       verandert per netwerk, dus gebruik de wildcard in plaats van het
       exacte adres uit de terminal)

5. **Start de Expo dev server**

   ```bash
   npm start
   ```

   Scan de QR-code met de Expo Go app (Android: scan direct vanuit de app;
   iOS: scan met de camera-app) om de app op je telefoon te openen. Je kunt
   ook `npm run ios` / `npm run android` gebruiken met een lokale simulator.

## Database schema

`supabase/migrations/0001_init.sql` bevat:

- `profiles` — sport, niveau, locatie, geboortedatum, geslacht, etc. (1:1 met `auth.users`)
- `swipes` — like/skip acties tussen profielen
- `matches` — ontstaat automatisch wanneer twee profielen elkaar liken
- `messages` — 1-op-1 chatberichten per match, met Supabase Realtime
- `posts` / `post_likes` — de "Bericht plaatsen" community-feed
- `subscriptions` — Basis / Premium / Elite abonnement per gebruiker

Alle tabellen hebben Row Level Security policies zodat gebruikers alleen hun
eigen data kunnen wijzigen en alleen berichten van hun eigen matches kunnen lezen.

## Scripts

- `npm start` — start de Expo dev server
- `npm run ios` / `npm run android` / `npm run web`
- `npm run typecheck` — TypeScript compileren zonder output

## Notities

- Sportfoto's en avatars gebruiken placeholder-URLs (`picsum.photos`, `i.pravatar.cc`)
  totdat gebruikers eigen foto's uploaden naar Supabase Storage.
- Het betaalscherm is een demo-formulier; koppel Stripe of Mollie via
  `EXPO_PUBLIC_PAYMENTS_PUBLIC_KEY` voor echte betalingen.
