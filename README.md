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
- `support_requests` — ingediende Klantenservice-berichten (back-up/overzicht,
  zie ook de "Klantenservice-e-mail"-sectie hieronder)

Alle tabellen hebben Row Level Security policies zodat gebruikers alleen hun
eigen data kunnen wijzigen en alleen berichten van hun eigen matches kunnen lezen.

## Klantenservice-e-mail (Resend)

Het Klantenservice-contactformulier (`app/settings/SupportScreen.tsx`) doet
twee dingen bij versturen: het bericht wordt altijd opgeslagen in
`support_requests` (de back-up/het overzicht), en daarna wordt best-effort
een Supabase Edge Function aangeroepen
(`supabase/functions/send-support-email`) die via [Resend](https://resend.com)
een e-mail stuurt naar **info.sportfrend@gmail.com**. Als die e-mail om wat
voor reden dan ook mislukt (functie nog niet gedeployed, Resend-fout, etc.)
blijft het bericht gewoon in de database staan - de gebruiker ziet nog
steeds de bevestiging, want het bericht ís ontvangen.

**Belangrijk:** deze sandbox heeft geen netwerktoegang tot Supabase's API, dus
de Edge Function kon hier niet gedeployed worden en `RESEND_API_KEY` kon niet
getest worden. Dit moet jij zelf doen:

1. **Deploy de Edge Function** met de [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref duefdlibkeghdskongjd
   supabase functions deploy send-support-email
   ```
2. **Controleer dat `RESEND_API_KEY` als secret op het Supabase-project staat**
   (jij gaf aan dat dit al geconfigureerd is):
   ```bash
   supabase secrets list
   ```
   Zo niet, zet 'm met `supabase secrets set RESEND_API_KEY=re_jouw_key`.
   Let op: dit is een **Supabase Edge Function secret**, geen
   `EXPO_PUBLIC_...`-variabele - hij wordt nooit in de app zelf gebruikt of
   meegebundeld, alleen server-side door de Edge Function gelezen.
3. **Afzenderadres**: de functie verstuurt standaard vanaf
   `Sportfrend <onboarding@resend.dev>` (Resend's gedeelde test-domein, werkt
   direct zonder domeinverificatie, maar is rate-limited en niet bedoeld voor
   productiegebruik). Verifieer een eigen domein in Resend en zet daarna de
   secret `RESEND_FROM_EMAIL` (bijv. `Sportfrend <support@sportfrend.app>`)
   voor een eigen afzenderadres.

## RevenueCat (Betalen-scherm)

Het Betalen-scherm (`app/premium/PaymentScreen.tsx`) draait nu in een
**sandbox-modus** die duidelijk als zodanig gelabeld is in de app: er wordt
geen echte betaling verwerkt, en `react-native-purchases` (RevenueCat's SDK)
is nog niet geïnstalleerd. Dat is een bewuste keuze, geen omissie: die SDK is
een native module die niet in Expo Go zit (in tegenstelling tot bijv.
`expo-image-picker` of `@react-native-community/datetimepicker`, die dat wel
zijn) - installeren zou een custom EAS development/production build vereisen,
en Expo Go (waarmee dit hele project tot nu toe getest is) zou de app dan
niet meer kunnen draaien.

`lib/purchases.ts` bevat wel al de productconfiguratie (product-ID's,
entitlements) die een echte koppeling zou gebruiken, en sandbox-versies van
de functies (`purchasePlanSandbox`, `restorePurchasesSandbox`) met exact de
vorm die de echte RevenueCat SDK-aanroepen straks zouden hebben - het
vervangen van die twee functies door echte `Purchases.purchasePackage()` /
`Purchases.restorePurchases()`-aanroepen zou de enige codewijziging moeten
zijn wanneer de SDK er eenmaal in zit.

**Stappen die jij zelf moet zetten om dit later echt te maken:**

1. Maak een account aan op [revenuecat.com](https://app.revenuecat.com) en
   maak een nieuw project aan.
2. Voeg in dat project een iOS-app en een Android-app toe (App Store
   Connect-bundle-ID / Google Play-pakketnaam van deze app).
3. Maak in **App Store Connect** en **Google Play Console** twee
   auto-renewable/abonnement-producten aan:
   - Premium — €4,99/maand — product-ID `sportfrend_premium_monthly` (iOS) /
     `sportfrend:premium-monthly` (Android)
   - Elite — €9,99/maand — product-ID `sportfrend_elite_monthly` (iOS) /
     `sportfrend:elite-monthly` (Android)
   (Deze exacte ID's staan ook in `lib/purchases.ts` - als je andere ID's
   kiest, moeten ze daar aangepast worden.)
4. Koppel die producten in RevenueCat aan twee entitlements, `premium` en
   `elite`, en maak een Offering met beide als packages.
5. Kopieer de **Public API keys** (RevenueCat-dashboard → Project settings →
   API keys) voor iOS en Android, en zet ze als
   `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` -
   zowel lokaal in `.env` als in de EAS-omgevingsvariabelen (dezelfde plek
   waar `EXPO_PUBLIC_SUPABASE_URL` nu al staat).
6. Laat daarna de daadwerkelijke SDK-installatie en -koppeling bouwen (een
   vervolgstap: `react-native-purchases` toevoegen, `lib/purchases.ts`'s
   sandbox-functies vervangen door echte SDK-aanroepen, en een nieuwe
   EAS-build maken) - dat kan pas nadat stap 1 t/m 5 hierboven staan, en dat
   testen kan dan niet meer via Expo Go.

## Scripts

- `npm start` — start de Expo dev server
- `npm run ios` / `npm run android` / `npm run web`
- `npm run typecheck` — TypeScript compileren zonder output

## Notities

- Sportfoto's en avatars gebruiken placeholder-URLs (`picsum.photos`, `i.pravatar.cc`)
  totdat gebruikers eigen foto's uploaden naar Supabase Storage.
- Het betaalscherm draait in een sandbox-modus (geen echte betaling) in
  afwachting van een echte RevenueCat-koppeling - zie de "RevenueCat"-sectie
  hierboven.
