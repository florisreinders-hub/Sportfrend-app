# Sportfrend

Nederlandse sportmaatje-matching app, gebouwd met Expo (React Native + TypeScript),
React Navigation en Supabase. De schermen zijn gebouwd op basis van het Sportfrend
Figma-bestand (`yhz6E1ex3WMPl4ieoK6XF0`) met exacte kleuren, fonts en spacing waar
beschikbaar.

## Functionaliteit

- **Onboarding**: inloggen, registreren (2 stappen), wachtwoord vergeten, locatie instellen
- **Ontdekken**: swipe-kaarten om sportmaatjes te vinden (Skip / Connect), met match-scherm en een dagelijkse aanbevelingslimiet per abonnement (zie "Dagelijkse aanbevelingslimiet" hieronder)
- **Connecties**: overzicht van je matches
- **Filter**: leeftijd, afstand, sport, niveau, beschikbaarheid
- **Profielen**: sporters bekijken, je eigen profiel bekijken en bewerken
- **Berichten**: community-feed ("Bericht plaatsen", alleen zichtbaar voor de auteur zelf en diens matches) en realtime 1-op-1 chat, inclusief het versturen van foto's
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
- `discover_daily_views` — welke profielen een gebruiker vandaag al te zien
  heeft gekregen in Ontdekken; voedt de dagelijkse aanbevelingslimiet per
  abonnement (zie 0019, "Dagelijkse aanbevelingslimiet" hieronder)
- `matches` — ontstaat automatisch wanneer twee profielen elkaar liken
- `messages` — 1-op-1 chatberichten per match, met Supabase Realtime;
  kunnen optioneel een `image_url` dragen (foto's, `chat-images`-bucket,
  zie 0018)
- `posts` / `post_likes` — de "Bericht plaatsen" community-feed, alleen
  zichtbaar voor de auteur en diens matches (RLS, zie 0017)
- `subscriptions` — Basis / Premium / Elite abonnement per gebruiker
- `support_requests` — ingediende Klantenservice-berichten (back-up/overzicht,
  zie ook de "Klantenservice-e-mail"-sectie hieronder)
- `reports` / `blocks` — moderatie: rapportages en blokkades tussen gebruikers
  (zie "Moderatie" hieronder)

Alle tabellen hebben Row Level Security policies zodat gebruikers alleen hun
eigen data kunnen wijzigen en alleen berichten van hun eigen matches kunnen lezen.

## Minimumleeftijd bij registratie

`RegisterDetailsScreen` (`app/auth/RegisterDetailsScreen.tsx`) vereist een
geboortedatum (niet langer optioneel) en weigert door te gaan met een
duidelijke foutmelding - "Je moet minimaal 18 jaar zijn om je te
registreren." - zodra die datum een leeftijd onder de 18 oplevert, vóórdat
er een e-mail/wachtwoord-account wordt aangemaakt. Zelfde plek en stijl als
de bestaande "dit e-mailadres is al geregistreerd"-melding.

Dat client-side check is voor directe feedback, niet de eigenlijke grens:
`public.profiles` heeft een check constraint
(`profiles_birthdate_min_age_check`, zie
`supabase/migrations/0015_profiles_min_age_check.sql`) die elke
geboortedatum onder de 18 weigert, ongeacht welke client de aanroep doet -
ook een aangepaste app die dit scherm overslaat kan er niet omheen. De
constraint staat `birthdate is null` nog wel toe (nodig voor het korte
moment tussen het aanmaken van de auth-gebruiker en de daaropvolgende
profiel-upsert die de geboortedatum invult), maar accepteert nooit een
aanwezige, te jonge waarde.

Draai `0015_profiles_min_age_check.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties. Geen Edge
Function nodig, alleen deze migratie. Als de `alter table` faalt omdat er
al een profiel met een te jonge geboortedatum bestaat, geeft het bestand
zelf een query om die rij(en) eerst op te sporen.

## Dagelijkse aanbevelingslimiet (Ontdekken)

De Pricing-tabel belooft per abonnement een ander aantal dagelijkse
aanbevelingen (Basis 5/dag, Premium 15/dag, Elite onbeperkt) - tot
migratie `0019_discover_daily_limit.sql` was dat puur tekst op het
betaalscherm: `discover_profiles()` gaf altijd dezelfde resultaten terug,
ongeacht `subscriptions.plan`.

Nu wordt dit server-side afgedwongen, in `discover_profiles()` zelf (dus
niet te omzeilen met een hand-gebouwde API-aanroep die de client
overslaat):

- `discover_daily_views` houdt per gebruiker bij welke profielen vandaag
  al getoond zijn. Dit is expres een aparte tabel, niet `swipes` - een
  getoond-maar-nog-niet-geswipete kaart moet bij elke herlaadbeurt van het
  Ontdekken-tabblad (`HomeScreen`'s `useFocusEffect` herlaadt altijd bij
  focus) als "al gezien" blijven tellen, anders zou alleen maar heen-en-
  weer wisselen tussen tabbladen al de hele dagelijkse limiet opsouperen
  aan kaarten waarop nog niet eens geswiped is.
- Alleen écht nieuwe (nog niet vandaag getoonde) kandidaten verbruiken een
  eenheid van de limiet; al eerder vandaag getoonde, nog ongeswipete
  kandidaten blijven altijd zichtbaar.
- `discover_plan_daily_limit(plan)` is de ene bron van waarheid voor de
  aantallen per plan; alleen een `subscriptions`-rij met `status =
  'active'` telt mee (een gekozen-maar-nooit-"betaald" `pending`-plan
  telt als Basis), en een gebruiker zonder rij telt ook als Basis.
- `discover_daily_status()` (RPC) geeft de client `{ plan, daily_limit,
  used_today, remaining }` terug, zodat `HomeScreen` een duidelijke
  "dagelijkse limiet bereikt"-melding met upgradeknop naar het
  Pricing-scherm kan tonen zodra `remaining` op 0 staat, in plaats van
  dezelfde generieke lege-staat als "geen kandidaten die aan je filters
  voldoen".
- RLS op `discover_daily_views` staat alleen `select` toe aan de eigenaar
  zelf; er is helemaal geen insert/update/delete-policy voor de
  `authenticated`-rol. Elke schrijfactie loopt uitsluitend via
  `discover_profiles()` (`SECURITY DEFINER`), dus een gebruiker kan zijn
  eigen "al gezien"-geschiedenis niet resetten of vervalsen om de limiet
  te omzeilen.

Draai `0019_discover_daily_limit.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties.

## Moderatie (rapporteren & blokkeren)

Op het "Sporters profiel bekijken"-scherm en in de chat (ChatDetailScreen)
staat een "..."-knop met "Rapporteren" en "Blokkeren". Rapporteren opent een
formulier (reden + optionele toelichting) dat een rij in `public.reports`
opslaat (`reporter_id`, `reported_id`, `reason`, `details`, optioneel
`match_id` bij een melding vanuit de chat, `status` default `'open'`).
Blokkeren slaat een rij op in `public.blocks` (`blocker_id`, `blocked_id`) en
navigeert direct terug.

Een blokkade werkt via RLS-policies op bestaande tabellen, niet via
clientcode: geblokkeerde gebruikers kunnen elkaars profiel niet meer lezen
(verdwijnen dus uit Ontdekken), hun match (en dus ook hun berichten) wordt
voor beiden verborgen, en nieuwe berichten tussen hen worden geweigerd. Zie
`supabase/migrations/0012_moderation_reports_blocks.sql` voor de volledige
SQL - draai deze migratie op je bestaande database (0001_init.sql is ook
bijgewerkt voor nieuwe installaties).

## RLS-beveiligingsaudit

`supabase/migrations/0013_rls_security_audit_fixes.sql` fixt vijf gaten die
een volledige audit van alle RLS-policies aan het licht bracht (zie het
bestand zelf voor de exacte SQL en toelichting per punt):

1. `swipes` had geen policy om een 'like' te zien die naar jou toe gestuurd
   is - de wederzijdse-like-check in `recordSwipe()` kon de andere
   persoon's rij daardoor nooit zien, dus een match ontstond in de praktijk
   nooit vanuit twee echte swipes over en weer.
2. `matches` had geen serverside check dat beide personen elkaar echt
   geliked hadden - elke ingelogde gebruiker kon via de API direct een
   "match" afdwingen met wie dan ook, en zo ongevraagd gaan chatten.
3. `matches` had helemaal geen DELETE-policy, waardoor "Vriend verwijderen"
   stil niets deed.
4. De "Profiel zichtbaar voor anderen"-schakelaar in Instellingen werd
   alleen client-side gefilterd in Ontdekken, niet afgedwongen door RLS -
   iemand met (of gokkend naar) een gebruikers-id kon een onzichtbaar
   profiel alsnog direct uitlezen.
5. `profiles.expo_push_token` was leesbaar voor elke ingelogde gebruiker via
   de overal gebruikte `select("*")` - omdat Expo's push-API een kaal token
   zonder verdere authenticatie accepteert, was dat genoeg om willekeurige
   pushmeldingen naar andermans toestel te sturen. Alle profiles-queries in
   de app gebruiken nu `lib/api.ts`'s `PROFILE_COLUMNS` in plaats van `"*"`.

Draai deze migratie op je bestaande database - `0001_init.sql` is ook
bijgewerkt zodat een nieuwe installatie deze fixes direct meekrijgt.

## Account verwijderen

"Account verwijderen" (onderaan Instellingen, onder "Uitloggen") vraagt
eerst om bevestiging via een destructieve alert, en roept daarna de
`delete-account` Edge Function aan (`lib/auth.ts`'s `deleteAccount()`).
Die functie draait met de service-role key (nodig om zowel de
`auth.users`-rij als de opgeslagen profielfoto's te verwijderen - dat kan
niet met een gewone gebruikerssessie) en verwijdert, in deze volgorde:

1. De bestanden van de gebruiker in de `profile-photos`-storage-bucket,
   en de door de gebruiker zelf geüploade chatafbeeldingen in de
   `chat-images`-bucket (per match waar de gebruiker deel van was) - die
   worden niet automatisch opgeruimd, er loopt geen foreign key van
   `storage.objects` naar `auth.users`.
2. De `auth.users`-rij zelf, via `auth.admin.deleteUser()`. Omdat
   `profiles.id` verwijst naar `auth.users(id)` met `on delete cascade`, en
   elke andere tabel met persoonlijke gegevens (`swipes`, `matches`,
   `messages`, `posts`, `post_likes`, `subscriptions`,
   `support_requests`, `reports`, `blocks`) op zijn beurt verwijst naar
   `profiles(id)` met `on delete cascade`, ruimt deze ene verwijdering
   automatisch alles op - geen aparte delete-statements per tabel nodig.

Na een geslaagde verwijdering logt de app ook lokaal uit
(`supabase.auth.signOut()`), zodat de sessie op het toestel meteen
verdwijnt en `RootNavigator` automatisch terugschakelt naar het
inlogscherm - hetzelfde mechanisme als de bestaande "Uitloggen"-knop.

De functie verifieert (in tegenstelling tot de twee pushmeldingen-functies)
gewoon het JWT van de aanroeper - alleen een echt ingelogde gebruiker kan
'm bereiken, en hij verwijdert altijd exact de gebruiker achter dat JWT,
nooit een id uit de request body.

**Belangrijk:** deze sandbox heeft geen netwerktoegang tot Supabase's API,
dus de functie kon hier niet gedeployed of getest worden. Deploy 'm zelf:

```bash
supabase functions deploy delete-account
```

(geen `--no-verify-jwt` hier, in tegenstelling tot de pushmeldingen-functies -
zie hierboven waarom.)

## Mijn gegevens opvragen (recht op inzage/dataportabiliteit)

"Mijn gegevens opvragen" (Instellingen → Account) toont een volledig
overzicht van alle gegevens die aan het account gekoppeld zijn - profiel,
matches + berichten, posts, swipes, abonnement, klantenservice-aanvragen,
ingediende rapportages en blokkades (zie ook `DATA_INVENTORY.md` voor de
volledige achterliggende inventarisatie). Het overzicht wordt volledig
client-side samengesteld (`lib/dataExport.ts`) met dezelfde RLS-beperkte
queries die de rest van de app al gebruikt om een gebruiker zijn eigen
rijen te laten lezen - er is geen service-role toegang voor nodig, RLS
beperkt elke bronquery al tot "eigen data".

Het overzicht wordt zowel in de app getoond als - via de knop "Verstuur
naar mijn e-mail" - verstuurd naar het eigen, bij het account geregistreerde
e-mailadres via de nieuwe `send-data-export-email` Edge Function. Die
functie haalt het e-mailadres zelf op via het JWT van de aanroeper
(`auth.getUser()`), niet uit iets dat de client meestuurt - zo kan dit
nooit gebruikt worden om andermans gegevens naar een ander adres te sturen.

**Belangrijk:** deze sandbox heeft geen netwerktoegang tot Supabase's API,
dus de functie kon hier niet gedeployed of getest worden. Deploy 'm zelf
(gebruikt dezelfde `RESEND_API_KEY`/`RESEND_FROM_EMAIL`-secrets als
`send-support-email` - niets nieuws te configureren):

```bash
supabase functions deploy send-data-export-email
```

## Locatieprivacy (exacte coördinaten niet meer ruw uitleesbaar)

`profiles.latitude`/`longitude` (exacte GPS-coördinaten) waren tot voor kort
ruw uitleesbaar door elke ingelogde gebruiker die een profiel mocht zien -
Ontdekken (`fetchDiscoverProfiles`, `lib/api.ts`) haalde ze rechtstreeks op
om de afstand client-side te berekenen. Sinds
`supabase/migrations/0014_discover_profiles_location_privacy.sql` is dat
niet meer mogelijk:

- **`get_my_location()`** (SQL-functie, `SECURITY DEFINER`) geeft alleen de
  eigen coördinaten van de aanroeper terug (`auth.uid()`) - gebruikt door
  `lib/AuthContext.tsx` (locatiecheck) en "Mijn gegevens opvragen".
- **`discover_profiles(...)`** (SQL-functie, `SECURITY DEFINER`) doet de
  volledige Ontdekken-query server-side: dezelfde sport/niveau/leeftijd/
  straal-filters als voorheen, maar geeft per kandidaat alleen een berekende
  `distance_km` terug - nooit de ruwe coördinaten. `fetchDiscoverProfiles`
  roept deze functie nu aan via `supabase.rpc(...)` in plaats van zelf
  haversine-wiskunde te doen op ruwe kolommen.
- Op tabelniveau is `select` op `latitude`/`longitude` volledig ingetrokken
  voor de `authenticated`-rol (`revoke select ... / grant select (...)` op
  `public.profiles`) - dit geldt ook voor de eigenaar zelf via een gewone
  kolom-select; alleen de functies hierboven kunnen er nog bij.

Zie `DATA_INVENTORY.md` §5 voor de volledige achtergrond. Draai
`0014_discover_profiles_location_privacy.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties. Geen Edge
Function of secret nodig, alleen deze migratie.

**Opvolgbug, gevonden en gefixt in `0016_discover_profiles_no_implicit_defaults.sql`:**
die eerste versie van `discover_profiles()` viel bij een niet-aangepast
sport-/afstandsfilter stilzwijgend terug op het eigen profiel van de
aanroeper (eigen sport, eigen `search_radius_km`) - terwijl het Filter-scherm
in precies die staat altijd "ALLE SPORTEN" en een concrete "NNKM"-waarde
toont, nooit een hint dat er iets anders wordt toegepast. Hierdoor
verschenen 10 nieuw aangemaakte testprofielen (zie
`supabase/seed/test_profiles_seed.sql`) niet in Ontdekken, puur omdat de
sport van het testende account toevallig niet overeenkwam met een van de
testprofielen. `p_sport`/`p_distance_km` worden nu exact toegepast zoals
het Filter-scherm ze laat zien, zonder impliciete substitutie. Draai ook
deze migratie op je bestaande database.

## Pushmeldingen (Expo Notifications)

Na inloggen/registreren vraagt de app om toestemming voor pushmeldingen
(`lib/notifications.ts`, aangeroepen vanuit `lib/AuthContext.tsx` zodra er
een echte sessie is - niet bij elke token refresh) en slaat het
apparaat-token op in `profiles.expo_push_token`. Twee database webhooks
(Postgres-triggers op `messages` en `matches`, zie
`supabase/migrations/0011_push_notifications.sql`) roepen bij elke nieuwe
rij een Edge Function aan (`send-message-push` / `send-match-push`) die de
Expo Push API aanroept. Beide functies respecteren de
"Pushmeldingen"-schakelaar in Instellingen (`profiles.push_notifications_enabled`)
- staat die uit, dan wordt er voor die gebruiker niets verstuurd.

**Belangrijke beperking: Expo Go ondersteunt sinds SDK 53 geen remote
pushmeldingen meer**, op geen van beide platforms - Expo Go is één
gedeelde app en kan daarom geen los push-certificaat per ontwikkelaars-app
meer hebben. `registerForPushNotificationsAsync()` herkent dit en slaat de
registratie over (met een duidelijke log-regel) in plaats van te crashen,
dus de rest van de app blijft gewoon werken in Expo Go zoals de rest van
dit project tot nu toe getest is. Om een écht werkend push-token te krijgen
en een melding te ontvangen, is een **custom development build** nodig
(`eas build --profile development`), geen Expo Go.

**Handmatige stappen die jij zelf moet zetten:**

1. **Deploy de twee Edge Functions** met de Supabase CLI:
   ```bash
   supabase functions deploy send-message-push --no-verify-jwt
   supabase functions deploy send-match-push --no-verify-jwt
   ```
   (`--no-verify-jwt` omdat deze functies worden aangeroepen door een
   database-trigger, niet door een ingelogde gebruiker - er is dus geen
   gebruikers-JWT om te verifiëren. De functies controleren in plaats
   daarvan zelf een gedeeld geheim, zie stap 2.)
2. **Zet een gedeeld geheim** dat de trigger en de functies gebruiken om
   elkaar te vertrouwen:
   ```bash
   openssl rand -hex 32
   supabase secrets set DB_WEBHOOK_SECRET=<de gegenereerde waarde>
   ```
3. **Voer de trigger-SQL uit** in de Supabase SQL Editor: open
   `supabase/migrations/0011_push_notifications.sql`, vervang beide
   `REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET`-plekken door dezelfde waarde als
   stap 2, en voer het bestand uit. (Gebruikt
   `supabase_functions.http_request` - hetzelfde mechanisme als de
   Database Webhooks-UI in het dashboard. Werkt dat om wat voor reden dan
   ook niet, maak dan dezelfde twee webhooks handmatig aan via
   **Database → Webhooks** in het dashboard, gericht op dezelfde
   function-URLs en header.)
4. **Optioneel: `EXPO_ACCESS_TOKEN`** - alleen nodig als je Expo's
   "enhanced push security" hebt ingeschakeld voor dit project
   (Expo-dashboard → project settings). Zo niet, hoeft dit niet gezet te
   worden; de Expo Push API werkt ook zonder.
5. **Test pas echt via een development build**, niet via Expo Go (zie de
   beperking hierboven).

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
