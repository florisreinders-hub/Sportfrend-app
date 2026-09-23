# Sportfrend

Nederlandse sportmaatje-matching app, gebouwd met Expo (React Native + TypeScript),
React Navigation en Supabase. De schermen zijn gebouwd op basis van het Sportfrend
Figma-bestand (`yhz6E1ex3WMPl4ieoK6XF0`) met exacte kleuren, fonts en spacing waar
beschikbaar.

## Functionaliteit

- **Onboarding**: inloggen, registreren (2 stappen), wachtwoord vergeten, locatie instellen
- **Ontdekken**: swipe-kaarten om sportmaatjes te vinden (Skip / Connect), met match-scherm en een dagelijkse aanbevelingslimiet per abonnement (zie "Dagelijkse aanbevelingslimiet" hieronder)
- **Connecties**: overzicht van je matches
- **Filter**: leeftijd, afstand, sport, niveau, beschikbaarheid - leeftijd
  en niveau zijn alleen bruikbaar voor Premium/Elite, de afstand is voor
  Basis begrensd op 50km (zie "Welke Ontdekken-filters een abonnement mag
  gebruiken" hieronder), en beschikbaarheid ("Slimme beschikbaarheids
  match") is exclusief voor Elite (zie "Slimme beschikbaarheids match
  (Elite-only)" hieronder)
- **Profielen**: sporters bekijken, je eigen profiel bekijken en bewerken
- **Berichten**: community-feed ("Bericht plaatsen", alleen zichtbaar voor de auteur zelf en diens matches, en alleen bruikbaar voor Premium/Elite - zie "Prikbord" hieronder) en realtime 1-op-1 chat, inclusief het versturen van foto's, een "Plan een training"-knop (Elite-only - zie "Trainings & Buddy Planner" hieronder) en een dagelijkse berichtenlimiet per abonnement (zie "Dagelijkse berichtenlimiet" hieronder)
- **Instellingen**: account, voorkeuren, e-mail wijzigen, "Mijn trainingen" (zie "Trainings & Buddy Planner" hieronder)
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

   **Heb je al een bestaand project?** Elke keer dat er een nieuw bestand
   in `supabase/migrations/` bijkomt, moet dat bestand ook los op je
   *bestaande* database gedraaid worden - dit gebeurt niet automatisch (er
   is geen omgeving hier met netwerktoegang tot Supabase om dat voor je te
   doen). Wordt dit overgeslagen, dan loopt de app op een schema dat achterloopt
   bij de code, wat zich meestal uit als een PostgREST-foutmelding zoals
   *"Could not find the 'X' column of 'Y' in the schema cache"* zodra de
   code een kolom/tabel/functie gebruikt die het migratiebestand toevoegt
   maar die nog niet op de database staat (zo brak het versturen van
   chatberichten toen `0018_chat_images.sql`'s `messages.image_url`-kolom
   wel in de code maar nog niet in de database stond). Elk migratiebestand
   is veilig om meerdere keren te draaien.

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

   De app gebruikt het `sportfrend://` custom scheme (`app.config.js` → `"scheme": "sportfrend"`)
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

## Welke Ontdekken-filters een abonnement mag gebruiken

Weer dezelfde soort belofte: de Pricing-tabel zegt Basis "Basisfilters"
(alleen Sport + Afstand, tot nu toe nooit ergens begrensd), Premium/Elite
"Uitgebreide filters" (Sport, Afstand, Leeftijd, Niveau). Migratie
`0021_discover_profiles_plan_filters.sql` dwingt dit af in
`discover_profiles()` zelf, niet alleen in de UI:

- Voor een Basis-account (of iemand zonder actieve `subscriptions`-rij)
  worden `p_level` en `p_max_age` genegeerd (op `null` gezet, dus geen
  filter) en wordt `p_distance_km` begrensd op 50km - ook als de
  aanroeper `null` ("onbeperkt") of een hogere waarde meestuurt. Dit is
  bewust een *clamp*, geen fout: een verouderde/gemanipuleerde
  filterwaarde degradeert netjes naar wat Basis wél mag, in plaats van de
  hele aanvraag te laten mislukken.
- Voor Premium/Elite blijft alles zoals het was: alle vier de filters
  werken, Afstand tot 150km.
- `FilterScreen.tsx` grijst Leeftijd en Niveau uit voor een Basis-account
  (met een hangslotje/"PREMIUM"-badge, tikken erop opent het
  Pricing-scherm) en begrenst de Afstand-slider zelf ook tot 50km - maar
  dat is puur UX. De echte grens is `discover_profiles()`: een
  hand-gebouwde RPC-aanroep die deze UI overslaat en toch `p_level`/
  `p_max_age`/een `p_distance_km` boven 50km meestuurt voor een
  Basis-account krijgt die waarden nog steeds genegeerd/begrensd.
- Het scherm haalt het huidige plan op via dezelfde
  `discover_daily_status()`-RPC als de aanbevelingslimiet hierboven (die
  geeft toch al `plan` terug, dus geen aparte RPC nodig). Een mislukte
  aanroep hier blijft niet stil - zie de `console.warn` in
  `FilterScreen.tsx` - en laat het scherm gewoon niets vergrendelen
  (`discover_profiles()` handhaaft de echte Basis-grenzen sowieso, ongeacht
  of deze aanroep lukt).
- Die plan-aanroep zit in een `useFocusEffect`, niet een gewone
  mount-only `useEffect`: `BottomNav` bereikt dit scherm via
  `navigation.navigate("Filter")`, en React Navigation's native-stack
  `navigate()` remount een scherm dat al in de stack zit niet - het
  brengt de bestaande instantie gewoon terug in focus. Een mount-only
  fetch zou dus maar één keer per app-sessie draaien (bij het allereerste
  bezoek) en daarna nooit meer, waardoor een plan dat pas ná dat eerste
  bezoek naar Basis wordt gezet (of gewoon nog niet compleet was
  ingesteld) op elk later bezoek stil de verouderde, niet-vergrendelde
  staat bleef tonen - exact het gerapporteerde symptoom.

Draai `0021_discover_profiles_plan_filters.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties. Controleer na
het draaien met:

```sql
select prosrc ilike '%v_plan = ''basis''%' as has_plan_filter_clamp
from pg_proc
where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace;
-- verwacht: true
```

## Slimme beschikbaarheids match (Elite-only)

Zelfde soort belofte als hierboven, maar dan voor de Pricing-regel
"Slimme beschikbaarheids match" die alleen bij Elite staat. Migratie
`0023_discover_profiles_availability_filter.sql` voegt op het
Filter-scherm een nieuwe "Beschikbaarheid"-filter toe (dagen van de
week, gebruikmakend van het bestaande `profiles.availability_days`-veld)
en dwingt af dat die alleen werkt voor een actief Elite-account:

- Een Elite-gebruiker kan op het Filter-scherm een of meerdere dagen
  selecteren. Ontdekken toont dan alleen nog kandidaten van wie
  `availability_days` op minstens één van die dagen overlapt met de
  gekozen dagen (`profiles.availability_days && p_availability_days` in
  `discover_profiles()`) - geen overlap, geen match qua beschikbaarheid.
- Voor Basis én Premium wordt `p_availability_days` genegeerd (op `null`
  gezet), ook als een hand-gebouwde RPC-aanroep buiten de UI om een
  waarde meestuurt - net als bij de Leeftijd/Niveau-clamp hierboven,
  maar dan voor alle plannen behalve Elite.
- `FilterScreen.tsx` grijst de dagen-chips uit voor Basis/Premium (met
  hetzelfde hangslotje, nu met een "ELITE"-badge in plaats van
  "PREMIUM" - `LockBadge` accepteert nu een `label`-prop), tikken erop
  opent het Pricing-scherm. Zelfde `useFocusEffect` + `console.warn` bij
  een mislukte `discover_daily_status()`-aanroep als bij de
  Leeftijd/Niveau-clamp - een mislukte statusaanroep vergrendelt dus
  nooit stilletjes niets extra, en laat de echte afdwinging aan
  `discover_profiles()` over.
- **Belangrijk voor wie deze migratie zelf toepast**: dit is de eerste
  migratie die een parameter *toevoegt* aan `discover_profiles()` (5 →
  6 argumenten). Postgres identificeert een functie via zijn volledige
  parameterlijst, dus `create or replace function` met een extra
  parameter vervangt de oude 5-argumenten-versie niet - het maakt er een
  *tweede*, overloaded functie naast. Elke aanroep met precies de oude 5
  argumenten (zoals een client die deze update nog niet heeft) krijgt
  dan `... is not unique` in plaats van gewoon te werken. Daarom bevat
  deze migratie een expliciete `drop function if exists
  public.discover_profiles(text, text, int, double precision, int);`
  vóór de `create or replace` - zonder die drop blijven er twee
  overloads bestaan.

Draai `0023_discover_profiles_availability_filter.sql` op je bestaande
database - `0001_init.sql` is ook bijgewerkt voor nieuwe installaties.
Controleer na het draaien met:

```sql
select
  (select count(*) from pg_proc where proname = 'discover_profiles'
     and pronamespace = 'public'::regnamespace) as overload_count,
  (select count(*) from pg_proc where proname = 'discover_profiles'
     and pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_availability_param,
  (select prosrc ilike '%availability_days && p_availability_days%' from pg_proc
     where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_overlap_check,
  (select prosrc ilike '%v_plan <> ''elite''%' from pg_proc
     where proname = 'discover_profiles' and pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(oid) ilike '%p_availability_days%') as has_elite_clamp;
-- verwacht: 1, 1, true, true (overload_count moet precies 1 zijn - staat er
-- 2, dan is de oude 5-argumenten-versie niet verwijderd en krijgt elke
-- 5-argumenten-aanroeper "is not unique"; draai dit bestand dan nogmaals,
-- de drop hierboven lost het op)
```

De migratie zelf bevat ook een zelfcontrolerend `do $$ ... $$`-blok
onderaan (zelfde aanpak als `0022_posts_premium_only.sql`) dat bij het
draaien zelf al een specifieke `EXCEPTION` opwerpt zodra iets hiervan
niet klopt, in plaats van een dubbelzinnige "Success" die achteraf niet
overeenkomt met een losse controlequery.

## Dagelijkse berichtenlimiet (chat)

Zelfde soort belofte, zelfde soort gat: de Pricing-tabel zegt Basis
"3 Berichten per dag sturen", Premium/Elite "Onbeperkt chatten", maar tot
migratie `0020_messages_daily_limit.sql` kon iedereen onbeperkt chatten.

Anders dan de Ontdekken-limiet hoeft hier geen aparte "al gezien"-tabel
bijgehouden te worden - een verstuurd bericht is een eenmalige actie
zonder het "opnieuw getoond, mag niet dubbel tellen"-probleem dat
`discover_daily_views` oplost, dus telt `can_send_message_today()`
gewoon rechtstreeks `messages` (`sender_id` + `created_at::date =
current_date`):

- `messages_plan_daily_limit(plan)` is de bron van waarheid voor de
  aantallen per plan (Basis 3, Premium/Elite onbeperkt/null) - zelfde
  patroon als `discover_plan_daily_limit(plan)`.
- `can_send_message_today()` (`SECURITY DEFINER`, scoped op `auth.uid()`)
  is de daadwerkelijke afdwinging: toegevoegd als extra voorwaarde aan de
  bestaande "Match participants can send messages" INSERT-policy op
  `public.messages`, dus elk bericht - via de app of een hand-gebouwde
  API-aanroep - loopt hier doorheen. Alleen een `subscriptions`-rij met
  `status = 'active'` telt mee (een `pending`-plan telt als Basis).
- `messages_daily_status()` (RPC) geeft `{ plan, daily_limit, used_today,
  remaining }` terug, zodat `ChatDetailScreen` een duidelijke "dagelijkse
  limiet bereikt"-melding met upgradeknop naar het Pricing-scherm kan
  tonen in plaats van het invoerveld, zodra `remaining` op 0 staat - een
  kale RLS-weigering is anders client-side niet te onderscheiden van "je
  bent geblokkeerd" of "dit is niet jouw match", die dezelfde generieke
  Postgres-foutmelding geven.
- Bekende beperking, met opzet niet opgelost: een INSERT met meerdere
  rijen tegelijk (een batch) toetst elke rij aan dezelfde snapshot van
  vóór het statement, dus zo'n batch zou in theorie de limiet kunnen
  omzeilen. De app zelf (`sendMessage()`, `lib/api.ts`) verstuurt altijd
  precies één bericht per keer, dus dit is alleen een gat voor een
  hand-gebouwde batch-aanroep, niet voor normaal app-gebruik.

Draai `0020_messages_daily_limit.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties.

## Prikbord ("Bericht plaatsen") is Premium/Elite-only

Anders dan de vorige twee secties gaat dit niet om een *aantal* dat
begrensd wordt, maar om de hele feature: Basis mag het prikbord
(`posts`/`post_likes` - "Bericht plaatsen" op de Connecties-tab én de
publieke Berichten-feed) helemaal niet gebruiken, noch lezen noch
schrijven. Dit staat volledig los van 1-op-1 chat (`messages`), die voor
elk abonnement beschikbaar blijft (met zijn eigen dagelijkse limiet
hierboven).

Migratie `0022_posts_premium_only.sql` voegt `has_posts_access()` toe
(`SECURITY DEFINER`, `true` alleen bij een `subscriptions`-rij met
`status = 'active'` en `plan in ('premium', 'elite')`) en AND't die in elke
bestaande policy op `posts` en `post_likes` (select/insert/delete op
`posts`, select/all op `post_likes`) - een Basis-account krijgt dus
letterlijk nul toegang tot deze twee tabellen, niet een narrowed view.

Zelfde soort onvermijdelijk neveneffect als `0017_posts_match_only.sql`:
RLS geldt voor élke lezer/schrijver van deze tabellen, ongeacht welk
scherm de query doet. Dit raakt dus ook:
- De publieke Berichten-feed (`PostsFeedScreen.tsx`, `fetchPosts()`) -
  kreeg dezelfde vergrendel-UI als de Connecties-tab.
- Een andermans profiel bekijken (`SporterProfileScreen.tsx`,
  `fetchPostsByAuthor()`) - toont voor een Basis-viewer gewoon de
  bestaande "Nog geen berichten geplaatst"-lege-staat, ook als die
  persoon wél iets geplaatst heeft. Niet onveilig (er lekt niets), wel
  een tekstueel onnauwkeurige melding - bewust buiten scope gelaten voor
  deze taak, maar het waard om te weten.

Beide geraakte schermen (`HomeScreen.tsx`'s Connecties-tab en
`PostsFeedScreen.tsx`) halen het huidige plan op via dezelfde
`discover_daily_status()`-RPC als de andere abonnementscontroles hierboven
(geeft toch al `plan` terug) en tonen bij Basis een duidelijke
"Premium-functie"-melding met knop naar het Pricing-scherm in plaats van
de samensteller/berichtenlijst. Een mislukte aanroep hier blijft niet
stil - zie de `console.warn` in beide bestanden.

Controlequery (ook in het migratiebestand):

```sql
select
  (select count(*) from pg_proc where proname = 'has_posts_access' and pronamespace = 'public'::regnamespace) as has_function,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
     and policyname = 'Posts are readable by their author or a match' and qual ilike '%has_posts_access%') as select_gated,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
     and policyname = 'Users manage their own posts' and with_check ilike '%has_posts_access%') as insert_gated,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'posts'
     and policyname = 'Users can delete their own posts' and qual ilike '%has_posts_access%') as delete_gated,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'post_likes'
     and policyname = 'Likes are readable by authenticated users' and qual ilike '%has_posts_access%') as likes_select_gated,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'post_likes'
     and policyname = 'Users manage their own likes' and qual ilike '%has_posts_access%' and with_check ilike '%has_posts_access%') as likes_all_gated;
-- verwacht: overal 1
```

Draai `0022_posts_premium_only.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties.

**Als de SQL editor "Success" toont maar de controlequery toch overal 0
geeft**: het bestand zelf eindigt met een `do $$ ... $$`-blok dat exact
diezelfde zes checks herhaalt en een specifieke `EXCEPTION` opwerpt zodra
er ook maar één ontbreekt (in plaats van de dubbelzinnige "Success" van
de losse controlequery) - draai het bestand nogmaals en lees die
foutmelding. De meest waarschijnlijke oorzaak is dat er maar een deel van
het geplakte bestand daadwerkelijk is uitgevoerd (bijvoorbeeld: in de SQL
editor voert "Run" alleen de *geselecteerde* tekst uit als er iets
gemarkeerd is, niet per se het hele plakvenster) of dat het tegen een
ander Supabase-project/branch draaide dan waarop de controlequery
daarna liep. Zie de kop van `0022_posts_premium_only.sql` zelf voor een
uitgebreidere diagnostequery die de daadwerkelijke policy-tekst toont in
plaats van alleen 0/1.

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

## Dagelijkse limiet op rapportages en klantenservice-aanvragen

Beide waren tot migratie `0026_reports_and_support_daily_limits.sql`
onbeperkt: een account kon oneindig vaak dezelfde of andere gebruikers
rapporteren (een mogelijk intimidatiemiddel - iemand overspoelen met
valse meldingen), en oneindig vaak het Klantenservice-formulier
versturen - wat bij elke keer een echte e-mail via Resend triggert
(`send-support-email`), dus onbeperkt misbruik kost daar ook echt
geld/quota, niet alleen ergernis.

Zelfde patroon als `messages_plan_daily_limit()`/`can_send_message_today()`/
`messages_daily_status()` (`0020_messages_daily_limit.sql`), met één
verschil: deze twee limieten zijn **plat, niet per abonnement** - valse
rapportages en support-spam zijn puur misbruikpreventie, geen
betaald-plan-voordeel om aan Basis te onthouden, dus krijgt elk plan
dezelfde limiet:

- **Rapportages: max 10 per dag** (`reports_daily_limit()`,
  `can_submit_report_today()`, gate op de "Users can create their own
  reports"-INSERT-policy op `reports`).
- **Klantenservice-aanvragen: max 5 per dag** (`support_requests_daily_limit()`,
  `can_submit_support_request_today()`, gate op de "Users can insert
  their own support requests"-INSERT-policy op `support_requests`).
- `reports_daily_status()` / `support_requests_daily_status()` (RPC's,
  `{ daily_limit, used_today, remaining }` - geen `plan`-kolom, want niet
  per-abonnement) laten `ReportModal.tsx` en `SupportScreen.tsx` een
  duidelijke "dagelijkse limiet bereikt"-melding tonen in plaats van het
  formulier, zodra `remaining` op 0 staat - een kale RLS-weigering is
  anders client-side niet te onderscheiden van elke andere "niet
  toegestaan"-fout. Een mislukte statusaanroep blijft niet stil - zie de
  `console.warn` in beide bestanden - en laat het formulier gewoon
  bruikbaar (`reports`/`support_requests`'s RLS-policies handhaven de
  echte grens sowieso, ongeacht of deze aanroep lukt).
- `ReportModal.tsx` haalt de status opnieuw op telkens als het sheet
  opent (niet bij mount - het component blijft mounted-maar-verborgen
  tussen keren open), zodat een limiet die sinds de vorige keer is
  bereikt meteen zichtbaar is. `SupportScreen.tsx` gebruikt een
  `useFocusEffect`, zelfde reden als de andere Instellingen-schermen.

Draai `0026_reports_and_support_daily_limits.sql` op je bestaande
database - `0001_init.sql` is ook bijgewerkt voor nieuwe installaties.
Controleer na het draaien met:

```sql
select
  (select count(*) from pg_proc where proname = 'can_submit_report_today'
     and pronamespace = 'public'::regnamespace) as has_report_check_fn,
  (select count(*) from pg_proc where proname = 'reports_daily_status'
     and pronamespace = 'public'::regnamespace) as has_report_status_fn,
  (select count(*) from pg_proc where proname = 'can_submit_support_request_today'
     and pronamespace = 'public'::regnamespace) as has_support_check_fn,
  (select count(*) from pg_proc where proname = 'support_requests_daily_status'
     and pronamespace = 'public'::regnamespace) as has_support_status_fn,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'reports'
     and policyname = 'Users can create their own reports'
     and with_check ilike '%can_submit_report_today%') as reports_insert_policy_gated,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'support_requests'
     and policyname = 'Users can insert their own support requests'
     and with_check ilike '%can_submit_support_request_today%') as support_insert_policy_gated,
  public.reports_daily_limit() as reports_daily_limit,
  public.support_requests_daily_limit() as support_requests_daily_limit;
-- verwacht: 1, 1, 1, 1, 1, 1, 10, 5
```

De migratie zelf bevat ook een zelfcontrolerend `do $$ ... $$`-blok
onderaan (zelfde aanpak als `0022`/`0023`/`0024`) dat bij het draaien
zelf al een specifieke `EXCEPTION` opwerpt zodra iets hiervan niet klopt.

**Getest**: lokaal (los Postgres-schema, geen netwerktoegang tot Supabase
vanuit deze omgeving) - 10 rapportages op een dag lukken, de 11e wordt
door RLS geweigerd; 5 klantenservice-aanvragen lukken, de 6e wordt
geweigerd; een andere gebruiker heeft zijn eigen, onafhankelijke teller
(niet beïnvloed door iemand anders' limiet); en de status-RPC's geven
zonder inloggen een nette fout in plaats van resultaten van een ander
account.

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

## Trainings & Buddy Planner (Elite-only)

Pricing-tabel: Elite heeft als enige "Slimme trainingsplanner". Een Elite-
gebruiker kan vanuit een chat (naast het berichtenveld, via de knop met het
kalender-icoon) een concreet trainingsvoorstel doen aan zijn/haar match -
datum, tijd, sport (voorgevuld met de gedeelde sport, zie `fetchSharedSport()`
in `lib/api.ts`), en optioneel locatie/opmerking. Dat voorstel verschijnt in
de chat als een aparte kaart (`components/TrainingCard.tsx`, ingevoegd
tussen de berichten op tijdstip - zie `ChatDetailScreen.tsx`'s
`chatItems`), niet als los tekstbericht, met "Accepteren"/"Voorstel
wijzigen" (en een kleinere "Afwijzen") voor wie het voorstel niet zelf
deed. Geaccepteerde trainingen staan ook onder Instellingen →
"Mijn trainingen" (`app/settings/MyTrainingsScreen.tsx`), voor beide
deelnemers, ongeacht ieders eigen abonnement.

**De "Mijn trainingen"-rij in Instellingen is tijdelijk verborgen** (op
verzoek, `SHOW_MY_TRAININGS_ROW` in `SettingsScreen.tsx` staat op
`false`) - de rest van de functie hierboven (voorstellen, accepteren,
wijzigen, afwijzen, de kaart in de chat) is onveranderd actief. Het
scherm/de route zelf (`MyTrainingsScreen.tsx`, `navigation/types.ts`'s
`"MyTrainings"`) bestaat nog gewoon; alleen de link ernaartoe is weg.
Zet `SHOW_MY_TRAININGS_ROW` terug op `true` om de rij weer te tonen.

Migratie `supabase/migrations/0024_trainings_planner.sql` (en, voor nieuwe
installaties, hetzelfde blok in `0001_init.sql`) legt dit vast:

- Nieuwe tabel `public.trainings` (`match_id`, `created_by`, `date`,
  `time`, `sport`, `location`, `note`, `status`
  `'pending'`/`'accepted'`/`'declined'`, `created_at`, plus
  `reminder_sent_at` - zie hieronder).
- **`has_elite_access()`** (mirrort `has_posts_access()` uit
  `0022_posts_premium_only.sql` één-op-één, alleen met `plan = 'elite'` in
  plaats van `plan in ('premium', 'elite')`) is de echte afdwinging van
  requirement 6: de "Elite match participants can propose trainings"
  RLS-policy op de INSERT staat een rij alleen toe als
  `has_elite_access()` waar is én de aanroeper een deelnemer van
  `match_id` is - een hand-gebouwde INSERT die de UI overslaat komt hier
  op precies dezelfde manier vast te zitten als de UI zelf (die het
  kalender-icoon vervangt door een hangslotje en naar Pricing linkt voor
  Basis/Premium).
- **Reageren is bewust niet Elite-only**: de UPDATE-policy ("Accepteren"/
  "Voorstel wijzigen"/"Afwijzen", en de daadwerkelijke rij-wijziging bij
  "Voorstel wijzigen") staat elke deelnemer toe, niet alleen Elite-
  accounts - een Basis/Premium-gebruiker die een voorstel van een Elite-
  match ontvangt, moet erop kunnen reageren. "Voorstel wijzigen" wijzigt
  de bestaande rij (geen nieuwe kaart, geen geschiedenis van
  overschreven voorstellen) en zet `created_by` op wie het laatst
  bijwerkte, zodat de ander weer "Accepteren"/"Voorstel wijzigen" te zien
  krijgt.
- **`reminder_sent_at`** staat niet letterlijk in de opgegeven
  kolommenlijst, maar is noodzakelijk: zonder een "al herinnerd?"-markering
  zou de periodieke herinneringsjob (hieronder) bij elke tik van zijn
  schema een dubbele push sturen zolang een training binnen het
  "begint over 2 uur"-venster valt.
- **`claim_training_reminders(p_window_minutes)`** (niet `security
  definer` - dit moet over de trainings/matches van *alle* gebruikers
  heen kunnen kijken, dus er is geen zinnig per-gebruiker bereik om het
  tot te beperken) claimt atomisch (één `update ... returning`) elke
  geaccepteerde, nog niet herinnerde training die over 2 tot 2+5 minuten
  begint, en zet meteen `reminder_sent_at`, zodat twee overlappende
  cron-ticks nooit dezelfde training dubbel melden. Alleen `service_role`
  mag deze aanroepen - de migratie trekt `EXECUTE` daarom expliciet in
  van `public`, `anon` én `authenticated` (`revoke execute ... from
  public, anon, authenticated`) vóór de `grant ... to service_role` - zie
  de eigenaardigheid hieronder over waarom "from public" alleen niet
  genoeg bleek te zijn.
- Datum/tijd worden ingevoerd als Europe/Amsterdam-kloktijd (de app doet
  nergens anders iets met tijdzones) - `claim_training_reminders()`
  interpreteert `(date + time)` expliciet als die tijdzone
  (`at time zone 'Europe/Amsterdam'`) vóór de vergelijking met `now()`
  (altijd UTC), zodat dit ook correct blijft rond de CET/CEST-omschakeling.

**Postgres-eigenaardigheid, ontdekt tijdens het lokaal testen:** in een
`create table`-kolomlijst is `time time` een geldige kolomdefinitie, maar
in een `returns table(...)`-clausule van een functie geeft `time time`
(in tegenstelling tot `date date`) een `syntax error at or near "time"` -
dit is opgelost door de kolomnaam daar te quoten (`"time" time`), verder
overal een gewone ongequote `time`-identifier.

**Supabase-eigenaardigheid, pas ontdekt na een melding dat de zelfcontrole
in 0024 faalde op een echte live database (lokaal testen miste dit -
zie hieronder):** elk Supabase-project draait bij het aanmaken al eens
(niet iets wat een migratie in deze repo zelf regelt):
```sql
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
```
Elke nieuwe functie in `public` krijgt daardoor `EXECUTE`
*rechtstreeks* toegekend aan `anon`/`authenticated`/`service_role` - niet
via de `PUBLIC`-pseudorol. `revoke execute ... from public` (de eerste
versie van deze migratie) trekt dus een recht in dat nooit de echte bron
van `authenticated`'s toegang was, en doet in de praktijk niets:
`authenticated` behoudt zijn eigen, rechtstreeks toegekende recht. De
zelfcontrole ving dit exact op ("authenticated can still execute
claim_training_reminders()"); de fix is expliciet ook intrekken van
`anon` en `authenticated`, niet alleen van `public` (zie de huidige
`revoke`-regel bij `claim_training_reminders()` hierboven). Mijn eigen
lokale testopstelling (los Postgres-schema, geen live Supabase-project)
repliceerde deze `alter default privileges`-instelling aanvankelijk niet
voor functies (wel al voor tabellen, anders faalden de RLS-testscenario's),
dus de lokale zelfcontrole gaf destijds ten onrechte groen licht -
inmiddels wel toegevoegd aan de testopstelling en opnieuw geverifieerd.

**Hergebruikt de pushmeldingen-infrastructuur** (requirement 5) in plaats
van iets nieuws te bouwen: de Edge Function `send-training-reminder-push`
importeert dezelfde `_shared/push.ts`-helpers
(`createServiceRoleClient`/`sendExpoPushNotifications`/`jsonResponse`/
`verifyWebhookSecret`) als `send-message-push`/`send-match-push`, en
hergebruikt hetzelfde `DB_WEBHOOK_SECRET` (0011_push_notifications.sql).
Het enige echte verschil: er is geen rij-event ("training begint over 2
uur" is geen INSERT/UPDATE) om een trigger op te zetten, dus
`supabase/migrations/0025_training_reminder_cron.sql` gebruikt in plaats
daarvan pg_cron + pg_net (`cron.schedule(...)` met `net.http_post(...)`)
om de functie elke 5 minuten aan te roepen - dezelfde
`x-webhook-secret`-header, alleen tijdgestuurd in plaats van
event-gestuurd.

**Handmatige stappen die jij zelf moet zetten** (bovenop de stappen bij
"Pushmeldingen" hierboven, die dit hergebruikt):

1. Draai `0024_trainings_planner.sql` (tabel/RLS/functies) - zie de
   controlequery bovenaan dat bestand.
2. **Deploy de Edge Function**:
   ```bash
   supabase functions deploy send-training-reminder-push --no-verify-jwt
   ```
3. **Zet pg_cron en pg_net aan**: Supabase-dashboard → Database →
   Extensions, zoek "pg_cron" en "pg_net", zet beide aan.
4. **Voer `0025_training_reminder_cron.sql` uit**, na het invullen van
   `REPLACE_WITH_YOUR_DB_WEBHOOK_SECRET` met dezelfde waarde als bij
   Pushmeldingen stap 2 (niets nieuws te genereren). Controleer met:
   ```sql
   select jobname, schedule, active from cron.job where jobname = 'training-reminder-push';
   -- verwacht: één rij, schedule = '*/5 * * * *', active = true
   ```

**Getest**: lokaal (los Postgres-schema, geen netwerktoegang tot Supabase
vanuit deze omgeving) met een Elite- en een Basis-testaccount op dezelfde
match - Elite kan een voorstel aanmaken, Basis niet (RLS-weigering, ook
voor een match waar de Elite-gebruiker zelf geen deelnemer van is); beide
deelnemers kunnen het voorstel lezen, een buitenstaander niet; de Basis-
ontvanger kan accepteren/"voorstel wijzigen" (en daarbij `created_by` naar
zichzelf laten verspringen) zonder zelf Elite te zijn; een buitenstaander
kan niet updaten; `claim_training_reminders()` claimt exact de
geaccepteerde, nog-niet-herinnerde training binnen het 2u-venster, negeert
er buiten liggende/`pending`/al-herinnerde trainingen, claimt bij een
tweede aanroep niets dubbel, en is voor zowel `authenticated` als `anon`
volledig ontoegankelijk (`permission denied`) - alleen `service_role` kan
hem aanroepen. Na de live-melding hierboven is de lokale testopstelling
zelf ook aangepast (Supabase's `alter default privileges ... on
functions`-gedrag gerepliceerd) en is dit scenario opnieuw bevestigd.

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

## RevenueCat (Premium/Elite-abonnementen)

Echte RevenueCat-integratie (`react-native-purchases` +
`react-native-purchases-ui`) - de eerdere sandbox-modus
(`purchasePlanSandbox`/`restorePurchasesSandbox`, een los custom
`PaymentScreen.tsx`) is vervangen. Beide pakketten zijn native modules,
net als `@sentry/react-native` - ze draaien niet in Expo Go, alleen in een
custom EAS dev/production build (zie "Development build op Android"
hierboven).

**Wat er nu staat:**

- Twee entitlements, `premium` en `elite` (matcht dit project se
  bestaande drie-lagen-abonnement: Basis/Premium/Elite blijft ongewijzigd
  - zie de "Welke Ontdekken-filters een abonnement mag gebruiken"-sectie
  hierboven voor hoe `subscriptions.plan` overal in de database gebruikt
  wordt).
- Vier producten (maandelijks + jaarlijks per plan), zie
  `REVENUECAT_PRODUCT_IDS` in `lib/purchases.ts`:
  - Premium maandelijks — `sportfrend_premium_monthly` (iOS) /
    `sportfrend:premium-monthly` (Android)
  - Premium jaarlijks — `sportfrend_premium_yearly` (iOS) /
    `sportfrend:premium-yearly` (Android)
  - Elite maandelijks — `sportfrend_elite_monthly` (iOS) /
    `sportfrend:elite-monthly` (Android)
  - Elite jaarlijks — `sportfrend_elite_yearly` (iOS) /
    `sportfrend:elite-yearly` (Android)
- Twee Offerings in RevenueCat, geïdentificeerd als `premium` en `elite`
  (`REVENUECAT_OFFERING_IDS`), elk met een maandelijks en een jaarlijks
  package. `PricingScreen.tsx`'s "Kies"-knop op de Premium-kaart
  presenteert de `premium`-offering, de Elite-kaart de `elite`-offering -
  via RevenueCat's eigen, kant-en-klare **Paywall**
  (`RevenueCatUI.presentPaywall({ offering })`,
  `presentPaywallForPlan()` in `lib/purchases.ts`). Die paywall regelt
  zelf package-selectie, de native store-aankoopdialoog,
  laad-/foutstatussen én "aankopen herstellen" - er is geen eigen
  betaalscherm meer nodig.
- **Customer Center** (`RevenueCatUI.presentCustomerCenter()`) voor
  zelfservice-abonnementsbeheer (opzeggen, wisselen van plan,
  aankoopgeschiedenis, restitutie aanvragen op iOS) - volledig
  geconfigureerd vanuit het RevenueCat-dashboard, geen eigen UI nodig.
  Instellingen → "Abonnement beheren" opent dit voor een account met een
  actief betaald abonnement, en `PricingScreen` (kiezen/upgraden) voor
  een Basis-account (`SettingsScreen.tsx`'s `onManageSubscription`).
- `lib/AuthContext.tsx` koppelt de RevenueCat-identiteit aan de
  Supabase-sessie: `Purchases.logIn(userId)` bij inloggen,
  `Purchases.logOut()` bij uitloggen, en een app-brede
  `CustomerInfoUpdateListener` die `customerInfo`/`plan` in de context
  actueel houdt (reactief, geen polling) - elk scherm leest dit via
  `useAuth()` in plaats van zelf RevenueCat aan te roepen.

**Waarom de database niet zomaar de client vertrouwt** (de belangrijkste
architectuurkeuze hier): de RevenueCat-SDK op een toestel is geen
vertrouwde bron voor wat de *database* moet geloven over iemands
abonnement - een aangepaste client zou zelf kunnen claimen "ik heb
Elite". De oude sandbox-flow had precies dit gat (`upsertSubscription()`
was gewoon door de client zelf aan te roepen, RLS controleerde alleen
"is dit je eigen rij", nooit "heb je hiervoor betaald"). Sinds
`0031_subscriptions_webhook_only.sql` mag `authenticated` niet meer
zelf naar `subscriptions` schrijven (alleen nog SELECT op de eigen rij)
- de **enige** schrijver is nu `supabase/functions/revenuecat-webhook`,
een server-side Edge Function (service-role key) die bij elke
RevenueCat-gebeurtenis de subscriber opnieuw opvraagt via RevenueCat's
eigen REST API (niet vertrouwen op de payload van één webhook-event
alleen, dat rapporteert maar één entitlement tegelijk) en op basis
daarvan `plan`/`status`/`price_cents`/`current_period_end` bijwerkt. De
client zelf gebruikt `CustomerInfo` nog wél rechtstreeks voor *directe*
UI-feedback (geen wachttijd op de webhook), maar de database - en dus
elke RLS-policy/SQL-functie die een betaalde functie afschermt - vertrouwt
uitsluitend wat via de webhook binnenkomt.

**Dashboard-setup die jij zelf moet doen** (kan niet vanuit deze sandbox
- geen netwerktoegang tot RevenueCat/App Store Connect/Play Console):

1. Maak een account aan op [revenuecat.com](https://app.revenuecat.com)
   en een project (of gebruik het bestaande project bij je meegegeven
   sleutel `test_JLnrnMjweEhqJrGiLDFLTMDyAza`).
2. Voeg een iOS-app en een Android-app toe aan dat project (App Store
   Connect-bundle-ID `com.sportfrend.app` / Google Play-pakketnaam
   `com.sportfrend.app`, zie `app.config.js`).
3. Maak in **App Store Connect** en **Google Play Console** de acht
   producten hierboven aan (auto-renewable/abonnement, maandelijks +
   jaarlijks per plan).
4. Koppel die producten in RevenueCat aan de entitlements `premium` en
   `elite`.
5. Maak twee Offerings, `premium` en `elite`, elk met een `$rc_monthly`-
   en `$rc_annual`-package die naar het bijbehorende product wijst.
6. Ontwerp voor beide Offerings een **Paywall** (Paywalls-tab in het
   dashboard - geen code nodig, RevenueCatUI rendert 'm native).
7. Zet **Customer Center** aan (Customer Center-tab) en configureer welke
   management-opties (opzeggen, plan wijzigen, ...) beschikbaar zijn.
8. Kopieer de **Public API keys** (Project settings → API keys → Public
   API keys) voor iOS en Android naar `EXPO_PUBLIC_REVENUECAT_IOS_KEY` /
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` - lokaal in `.env` én als
   EAS-omgevingsvariabelen (dezelfde plek als `EXPO_PUBLIC_SUPABASE_URL`).
   De meegegeven sleutel (`test_JLnrnMjweEhqJrGiLDFLTMDyAza`) is zo'n
   Public API key - controleer in het dashboard of dit de iOS- of de
   Android-sleutel is (of dezelfde geldt voor beide) en vul de andere aan.
9. Zet de webhook op (Project settings → Integrations → Webhooks → +
   Add): URL = je gedeployde `revenuecat-webhook`-functie
   (`https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`),
   Authorization header value = een zelfgekozen random string.
10. Deploy de functie en zet de bijbehorende secrets (nooit hier
    committen):
    ```
    supabase functions deploy revenuecat-webhook --no-verify-jwt
    supabase secrets set REVENUECAT_SECRET_KEY=<RevenueCat Secret API key>
    supabase secrets set REVENUECAT_WEBHOOK_AUTH_HEADER=<dezelfde random string als stap 9>
    ```
    (`REVENUECAT_SECRET_KEY` is de **Secret** API key, niet de Public key
    uit stap 8 - Project settings → API keys → Secret API keys. Deze mag
    nooit in de client terechtkomen.)
11. Maak sandbox/test-accounts aan (App Store Connect → Sandbox Testers,
    Google Play Console → License testers) om een aankoop echt te kunnen
    doorlopen zonder te betalen.

**Build/testen - géén `eas update` (OTA) meer voor deze wijziging.**
`react-native-purchases`/`react-native-purchases-ui` zijn native modules
die net toegevoegd zijn - een bestaande, al geïnstalleerde preview/
production build heeft die native code nog niet, en zou crashen op elke
aanroep ernaartoe als je deze wijziging via een gewone OTA-update
publiceert. Er is een **nieuwe native build** nodig, niet zomaar een
JS-update:
```
npx eas-cli build --profile development --platform android
npx eas-cli build:run --platform android --latest
```
(zelfde development-buildprofiel als in "Development build op Android"
hierboven - stap 1 t/m 11 hierboven moeten wel eerst staan, anders is er
niets om te testen).

**Getest**: `npx tsc --noEmit` schoon (tegen de daadwerkelijk
geïnstalleerde SDK's eigen TypeScript-definities, niet alleen aannames);
`expo export` bundelt zonder fouten en de bundel bevat de nieuwe
paywall-/customer-center-aanroepen en alle acht product-ID's. De
`0031_subscriptions_webhook_only.sql`-migratie is lokaal getest (los
Postgres-schema): vóór de migratie kon een ingelogde gebruiker zichzelf
via een directe UPDATE naar `plan = 'elite'` zetten (de kwetsbaarheid
bevestigd); ná de migratie weigert diezelfde UPDATE (0 rijen, RLS), een
gebruiker kan nog wel zijn eigen rij lezen maar niet die van een ander,
en een write via de service-role (wat de webhook gebruikt) werkt
onveranderd. De Edge Function zelf (Deno, buiten `tsc`'s scope) en de
daadwerkelijke aankoopflow (paywall, entitlement-toekenning,
webhook-aflevering) zijn handmatig nagelopen tegen RevenueCat's
gedocumenteerde API, maar kunnen alleen écht getest worden tegen een
opgezet RevenueCat-project + een native build op een toestel/simulator -
geen van beide is beschikbaar in deze sandbox.

## Sentry crash-reporting

`ErrorBoundary.tsx` bestond al, maar deed tot nu toe alleen `console.error(...)`
- onzichtbaar in een gepubliceerde/preview build, dus in de praktijk nul
zichtbaarheid op crashes bij echte gebruikers. `@sentry/react-native`
(+ diens Expo-config-plugin en Metro-integratie) verhelpt dat: onafgehandelde
JS-exceptions, onafgehandelde promise-rejections, én render-fouten die
`ErrorBoundary.tsx` opvangt, komen nu allemaal in het Sentry-dashboard
terecht, met leesbare (niet-geminificeerde) stacktraces.

**Hoe dit is opgezet:**

- **`app.config.js`** (was `app.json` - moest dynamisch worden om
  `SENTRY_DSN` uit de environment te kunnen lezen, wat een los `app.json`
  niet kan) voegt `"@sentry/react-native"` toe aan `plugins` - dit is Sentry's
  eigen Expo-config-plugin, die bij een `eas build` automatisch een
  build-fase in het native Xcode-/Gradle-project injecteert die source maps
  bouwt en uploadt. **Dat is dus letterlijk de "EAS Build-hook"** voor
  source maps - geen los handgeschreven hook-script nodig, Sentry's plugin
  regelt de native build-fase zelf. Bewust geen `organization`/`project`/
  `authToken` als plugin-config meegegeven (Sentry's eigen plugin waarschuwt
  daar expliciet tegen - een authToken in `app.config.js` zou in de
  geshipte app terechtkomen) - die komen in plaats daarvan uit
  `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`, gelezen als
  environment variables tijdens de build zelf (standaard sentry-cli-gedrag).
- **`metro.config.js`** (nieuw bestand - bestond nog niet) gebruikt
  `getSentryExpoConfig()` uit `@sentry/react-native/metro`. Dit is het
  eigenlijke mechanisme achter leesbare stacktraces: het voegt een Metro-
  serializer toe die een uniek **Debug ID** inbakt in zowel de bundel als
  de bijbehorende source map. Sentry matcht een crash aan zijn source map
  via dat Debug ID, niet via een release-naam - belangrijk voor dit
  project specifiek, omdat de meeste wijzigingen via `eas update` (OTA)
  verschijnen, niet via een verse `eas build` waar een release-naam
  natuurlijk bij past.
- **`lib/sentry.ts`** leest de DSN via `Constants.expoConfig.extra.sentryDsn`
  (zie hieronder waarom niet rechtstreeks via `process.env`), en roept
  `Sentry.init()` aan met:
  - `release`: `<slug>@<version>` (stabiel per app-store-versie)
  - `dist`: `Updates.updateId` (een verse UUID per `eas update`-publicatie)
    of `"dev"` als er geen actieve OTA-update is - dit is wat "release-
    tracking per build" hier concreet betekent, aangezien native
    `eas build`s zeldzaam zijn vergeleken met `eas update`-publicaties.
  - `environment`: `Updates.channel` (`development`/`preview`/`production`,
    dezelfde drie kanalen als `eas.json`), met een `__DEV__`-fallback voor
    een lokale Metro-dev-server-sessie waar `Updates.channel` altijd `null`
    is.
  - Faalt open zoals de rest van deze app's optionele-configuratie-afhandeling
    (`isSupabaseConfigured`, `lib/supabase.ts`): ontbreekt `SENTRY_DSN`, dan
    wordt er een `console.warn` gelogd en slaat `initSentry()` de rest over
    in plaats van de app te laten crashen bij opstarten.
  - `Sentry.init()`'s standaard-integraties installeren zelf al een globale
    `ErrorUtils`-handler (onafgehandelde JS-exceptions) én
    unhandled-rejection-tracking - het aanroepen van `Sentry.init()` zelf is
    dus al genoeg, geen aparte handlers nodig.
- **`App.tsx`** roept `initSentry()` aan op module-niveau (buiten de
  component, vóórdat er iets anders kan crashen) en exporteert
  `Sentry.wrap(App)` in plaats van de kale `App`-component - dat voegt
  Sentry's eigen top-level foutopvang en touch-breadcrumbs toe, *naast* de
  bestaande `ErrorBoundary` binnenin (die blijft ongewijzigd voor zijn
  eigen Nederlandstalige fallback-UI).
- **`ErrorBoundary.tsx`** roept nu `Sentry.captureException(error, ...)`
  aan in `componentDidCatch` - een render-fout die hier terechtkomt bereikt
  nooit de globale `ErrorUtils`-handler (React vangt hem af vóórdat hij
  daar komt), dus dit is het enige punt waar zo'n fout alsnog gerapporteerd
  wordt.

**Waarom `SENTRY_DSN` (geen `EXPO_PUBLIC_`-prefix) via `extra` in plaats van
rechtstreeks `process.env`:** een DSN is geen geheim (het is een write-only
eindpunt-identifier, vergelijkbaar met een Segment/Mixpanel write-key) en zou
prima met een `EXPO_PUBLIC_`-prefix gekund hebben, zoals
`EXPO_PUBLIC_SUPABASE_URL`. Omdat de variabele hier al vast `SENTRY_DSN` heet
(zonder prefix), leest `app.config.js` hem in plaats daarvan in op
config-evaluatietijd (Node.js, niet Metro) en geeft hem door via `extra` -
`lib/sentry.ts` leest hem terug via `Constants.expoConfig.extra.sentryDsn`.

**Test-crash-knop** (Instellingen → onderaan, alleen zichtbaar met
`__DEV__`): gooit een fout rechtstreeks vanuit een `onPress`-handler, dus
*buiten* React's render-cyclus om - dit test bewust het nieuwe globale-
foutafhandelings-pad (`ErrorUtils`, via `Sentry.init()`'s standaard-
integraties), niet het al langer bestaande `ErrorBoundary`-pad. Verschijnt
in een build waarin `SENTRY_DSN` correct staat na een paar seconden als
nieuwe issue in het Sentry-dashboard.

**Handmatige stappen die jij zelf moet zetten:**

1. **Maak een Sentry-project aan** (Platform: React Native), en kopieer de
   DSN (Project settings → Client Keys (DSN)).
2. **Zet `SENTRY_DSN`** lokaal in `.env` én als EAS-omgevingsvariabele
   (dezelfde plek als `EXPO_PUBLIC_SUPABASE_URL`).
3. **Voor source maps op een echte `eas build`** (App Store/Play Store-
   inzendingen): zet `SENTRY_ORG`, `SENTRY_PROJECT` en `SENTRY_AUTH_TOKEN`
   (Sentry-dashboard → Settings → Auth Tokens, scope `project:releases` +
   `org:read`) als EAS-secrets:
   ```bash
   eas secret:create --scope project --name SENTRY_ORG --value <je-org-slug>
   eas secret:create --scope project --name SENTRY_PROJECT --value <je-project-slug>
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <je-auth-token> --type string
   ```
   De config-plugin regelt de rest automatisch tijdens de build.
4. **Voor source maps op een `eas update`-publicatie** (de gebruikelijke
   manier waarop dit project wijzigingen uitrolt - geen native build, dus
   de stap hierboven wordt dan nooit uitgevoerd): bouw en publiceer met
   dezelfde, vooraf gebouwde `dist`-map, en upload daarna diezelfde map naar
   Sentry:
   ```bash
   npx expo export --platform all --source-maps
   npx eas-cli update --branch preview --input-dir dist --skip-bundler --non-interactive
   SENTRY_AUTH_TOKEN=<je-auth-token> SENTRY_ORG=<je-org-slug> SENTRY_PROJECT=<je-project-slug> \
     npm run sentry:upload-sourcemaps
   ```
   (`--input-dir dist --skip-bundler` laat `eas update` exact de al
   gebouwde map publiceren in plaats van zelf nog een keer te bundelen -
   zonder dat zouden de geüploade source maps niet gegarandeerd bij de
   daadwerkelijk gepubliceerde bundel horen.)
5. **Bouw en installeer een development build op een Android-testtoestel**
   om de crash-knop te kunnen zien (die is `__DEV__`-only, dus nooit
   zichtbaar in een preview/productie-build) - zie
   "Development build op Android (voor de Sentry-testknop)" hieronder voor
   de exacte commando's.
6. **Test met de verborgen crash-knop** (Instellingen, onderaan) en
   controleer of de fout binnen enkele seconden in het Sentry-dashboard
   verschijnt, met een leesbare (niet-geminificeerde) stacktrace.

### Development build op Android (voor de Sentry-testknop)

Geen Google Play Console-account nodig - "internal distribution" is een
kaal, rechtstreeks installeerbaar `.apk`-bestand, buiten de Play Store om
(zelfde aanpak als eerder voor het testen van echte pushmeldingen, zie
"Pushmeldingen" hierboven: Expo Go ondersteunt sinds SDK 53 geen remote
pushmeldingen meer, en kan hoe dan ook nooit een custom native module als
`@sentry/react-native` laden - vandaar een eigen development build in
plaats van Expo Go).

```bash
# 1. Eenmalig: zorg dat SENTRY_DSN lokaal bekend is (stap 1-2 hierboven) -
#    de dev-client haalt zijn JS live op van jouw Metro-server (stap 4
#    hieronder), dus app.config.js leest SENTRY_DSN dan uit jouw eigen
#    lokale .env, niet uit een EAS-secret.
cat .env | grep SENTRY_DSN   # controleer dat hij hier al in staat

# 2. Start de build in de cloud (~10-15 min, geen Android Studio/Xcode
#    lokaal nodig). Eerste keer: EAS biedt aan een Android-keystore voor
#    je te genereren - accepteer dat, geen Play Console-account nodig.
npx eas-cli build --profile development --platform android

# 3. Zodra de build klaar is, installeer hem op je Android-toestel.
#    Optie A - eenvoudigst, geen kabel nodig: scan de QR-code die eas
#    build aan het eind toont met je telefoon (of open de build-URL in de
#    browser op je telefoon) en tik "Installeren". Android vraagt de
#    eerste keer om toestemming voor "apps van deze bron installeren".
#    Optie B - telefoon via USB verbonden met deze computer (adb/USB-
#    debugging aan): installeert automatisch op het aangesloten toestel.
npx eas-cli build:run --platform android --latest

# 4. Start de Metro-bundler (dezelfde .env als stap 1 wordt hier gebruikt)
#    en open de zojuist geïnstalleerde app op je telefoon - die toont een
#    "dev client"-scherm waar je verbindt met deze sessie (scan de QR-code
#    die hieronder verschijnt, telefoon en computer moeten op hetzelfde
#    wifi-netwerk zitten - gebruik --tunnel als dat niet zo is).
npx expo start --dev-client

# 5. Log in de app in (of maak een testaccount) tot je bij Instellingen
#    bent, tik helemaal onderaan op "Test crash (Sentry)", en kijk binnen
#    een paar seconden in het Sentry-dashboard (Issues) of de fout
#    verschijnt.
```

**Getest vanuit deze omgeving** (geen live Sentry-account/netwerktoegang tot
sentry.io beschikbaar hier, dus de daadwerkelijke dashboard-check is aan
jou - zie stap 6 hierboven): `npx tsc --noEmit` schoon; `npx expo export
--source-maps` produceert een `.hbc`-bundel mét bijbehorende `.map` met een
`debugId`-veld; `sentry-expo-upload-sourcemaps dist` herkent en matcht die
bundel+sourcemap correct (faalt zoals verwacht pas op de daadwerkelijke
netwerkupload, door een nep-token en geen netwerktoegang vanuit deze
sandbox); een bundle-export bevestigt dat de test-crash-knop alleen in
een `--dev`-bundel aanwezig is, niet in een productie-achtige bundel; en
`npx eas-cli config --profile development --platform android` bevestigt
dat het `development`-buildprofiel daadwerkelijk resolvet naar
`distribution: internal`, `developmentClient: true`, `buildType: apk` en
`credentialsSource: remote` (EAS genereert zelf een Android-keystore,
geen Play Console-account nodig). `expo-dev-client` was nog geen
dependency - zonder dat pakket faalt een `developmentClient: true`-build;
toegevoegd via `npx expo install expo-dev-client` en aan `app.config.js`'s
`plugins` toegevoegd (veilig voor élk profiel - `eas.json`'s eigen
`developmentClient`-vlag per profiel bepaalt of de dev-launcher-native-code
daadwerkelijk actief is, niet de aanwezigheid van deze plugin).

## Contentfilter (aanstootgevende taal)

Basale, automatische filter op bio (profiel), berichten (chat), posts
(prikbord) en trainingsvoorstellen (opmerking-veld), ter voorbereiding op
Apple's App Store Review Guideline 1.2 (User-Generated Content), die van
apps met UGC verlangt dat ze objectionable content kunnen filteren en een
manier hebben om het te verwijderen.

**Hard blokkeren, niet waarschuwen-met-doorsturen.** `0027_content_filter.sql`
koos aanvankelijk voor "waarschuwen + toch kunnen versturen + markeren"
(afweging nog steeds volledig uitgeschreven bovenaan dat bestand, als
achtergrond). `0028_content_filter_hard_block.sql` verandert dit naar
een expliciete, bewuste productbeslissing: een treffer wordt nu
**geweigerd**, niet alleen gemarkeerd - er is geen "toch versturen"-optie
meer, de gebruiker moet de tekst aanpassen.

**Hoe het hard blokkeren technisch werkt** (zie de volledige uitleg
bovenaan `0028_content_filter_hard_block.sql`): de vier triggers zijn
`BEFORE INSERT/UPDATE` (was `AFTER`). Bij een treffer schrijft
`flag_content_if_needed()` eerst een rij naar `flagged_content`, en geeft
daarna `return NULL` - Postgres' ingebouwde manier om die ene rij
stilletjes te annuleren zónder een fout op te werpen die ook de
zojuist geschreven audit-rij zou terugdraaien (`raise exception` zou dat
wél doen - Postgres kent geen "onafhankelijke" subtransactie binnen
dezelfde triggeraanroep zonder een aparte databaseverbinding, bv. via
`dblink` - een afhankelijkheid die hier bewust vermeden is). Een
geannuleerde INSERT/UPDATE meldt zich bij de client als "0 rijen
geraakt", niet als een foutmelding - daarom gebruikt elke schrijfactie nu
`.select().single()` (`sendMessage()`, `createPost()`,
`createTraining()`/`updateTrainingProposal()` in `lib/api.ts`, en de
profiel-upsert in `EditProfileScreen.tsx`): PostgREST geeft dan een
expliciete, herkenbare fout (`PGRST116`, "0 rows") in plaats van een
stille no-op die de gebruiker laat denken dat het gelukt is.
`getDataErrorMessage()` (`lib/api.ts`) vertaalt die `PGRST116`-fout naar
een vriendelijke melding - dit is puur het server-side vangnet voor een
client die de onderstaande client-side check overslaat; de normale flow
komt hier nooit, omdat `checkContentFilter()` de aanvraag al client-side
tegenhoudt vóórdat de server ooit bereikt wordt.

**Opbouw** (`0027_content_filter.sql` + `0028_content_filter_hard_block.sql`,
gemirrored in `0001_init.sql` voor nieuwe installaties):

- `content_filter_words` — de woordenlijst zelf: `word`, `language`
  (`nl`/`en`), `category` (`scheldwoord`/`seksueel`/`haatdragend`),
  `active`. RLS aan, bewust **geen** policies - alleen beheerbaar via
  directe SQL (SQL editor/migraties), nooit via de app. Uitbreiden of
  uitschakelen kan zonder ooit een release te doen:
  ```sql
  insert into public.content_filter_words (word, language, category)
  values ('nieuwerdant', 'nl', 'scheldwoord');

  update public.content_filter_words set active = false where word = 'trut';
  ```
  Basisset: ~60 woorden, Nederlands + Engels, verdeeld over
  scheldwoorden/seksueel-expliciet/haatdragend - bewust compact om valse
  positieven te beperken, geen uitputtende lijst.
- `find_flagged_words(text) returns text[]` — de matcher. Woordgrens-
  matching (`\m...\M`, Postgres' "heel woord", geen kale substring) zodat
  bv. "ras" niet matcht binnen "raster". Let op: dit is bewust een
  heel-woord-match, dus "kutzooi" (aan elkaar geschreven) matcht **niet**
  op "kut" - hetzelfde principe dat "raster" beschermt. `security
  definer` + `grant execute ... to authenticated`, zodat de client 'm kan
  aanroepen voor de waarschuwing vóór versturen, zonder zelf `SELECT` op
  de ruwe woordenlijst nodig te hebben (die blijft zo onzichtbaar voor de
  client).
- `flagged_content` — audit trail van **geweigerde pogingen** (sinds
  `0028`; vóór `0028` was dit een audit trail van gepubliceerde-maar-
  gemarkeerde content): `user_id`, `source_table`
  (`profiles`/`messages`/`posts`/`trainings`), `source_id` (bij een
  geweigerde INSERT: het al gegenereerde maar nooit weggeschreven id van
  die rij - Postgres vult kolomdefaults al in vóórdat een BEFORE-trigger
  draait; bij een geweigerde UPDATE: het echte id van de bestaande,
  ongewijzigd gebleven rij), `matched_words`, `reason`, `status`
  (`pending`/`reviewed`/`dismissed`), `created_at`. RLS aan, bewust
  **geen** policies - anders dan `reports` kan zelfs de geweigerde
  gebruiker zijn eigen rijen hier niet zien (dat zou het triggerende
  woord weglekken). Bedoeld voor het moderatie-overzicht (aparte taak)
  via directe service-role-toegang.
- `flag_content_if_needed()` — de trigger-functie, kijkt via
  `TG_TABLE_NAME` welke tekstkolom/eigenaar-kolom hoort bij de tabel die
  hem aanriep. Bij een treffer: schrijft een rij naar `flagged_content`,
  daarna `return NULL` (annuleert de INSERT/UPDATE). Zonder treffer:
  `return NEW` (gaat gewoon door).
- Vier `BEFORE`-triggers: `flag_bio_content` (`profiles`, `insert or
  update of bio`), `flag_message_content` (`messages`, `insert`),
  `flag_post_content` (`posts`, `insert`), `flag_training_content`
  (`trainings`, `insert or update of note`).
- `lib/contentFilter.ts` — client-side helpers: `checkContentFilter(text)`
  roept `find_flagged_words()` aan (faalt open - een mislukte aanroep
  laat de poging client-side doorgaan, de server-side trigger hierboven
  is dan het vangnet, net als elke andere optionele status-RPC in dit
  project) en `showContentFilterBlockedAlert(what, participle)` toont de
  "Ongepaste taal"-melding met alleen een "OK"-knop - geen "toch
  versturen"-optie. Aangeroepen vanuit `EditProfileScreen.tsx` (bio),
  `ChatDetailScreen.tsx` (bericht, ook bij een afbeelding met bijschrift),
  `NewPostScreen.tsx` (post), `TrainingFormModal.tsx` (opmerking, alleen
  als niet leeg) en `MatchScreen.tsx` (het allereerste bericht na een
  nieuwe match/"CONNECTIE!").

Draai `0027_content_filter.sql` gevolgd door
`0028_content_filter_hard_block.sql` op je bestaande database (als
`0027` al gedraaid is, volstaat alleen `0028`) - `0001_init.sql` is ook
bijgewerkt voor nieuwe installaties. Controleer na het draaien met:

```sql
select
  tgname,
  case when tgtype & 2 = 2 then 'BEFORE' else 'AFTER' end as timing
from pg_trigger
where tgname in ('flag_bio_content', 'flag_message_content', 'flag_post_content', 'flag_training_content')
  and not tgisinternal
order by tgname;
-- verwacht: alle vier op 'BEFORE'

select pg_get_functiondef('public.flag_content_if_needed()'::regprocedure) ilike '%return null%' as hard_blocks;
-- verwacht: true

select public.find_flagged_words('die training was echt kut vandaag') as test_match;
-- verwacht: {kut}
```

Beide migraties bevatten ook een zelfcontrolerend `do $$ ... $$`-blok
onderaan (zelfde aanpak als `0022`/`0023`/`0024`/`0026`) dat bij het
draaien zelf al een specifieke `EXCEPTION` opwerpt zodra iets hiervan
niet klopt.

**Getest**: lokaal (los Postgres-schema met minimale stand-ins voor
`profiles`/`messages`/`posts`/`trainings`, geen netwerktoegang tot
Supabase vanuit deze omgeving) - beide migraties draaien idempotent; een
schone bio/bericht/post/trainingsopmerking slaagt gewoon (1 rij
geraakt/geretourneerd); een tekst met een woord uit de lijst
(Nederlands én Engels getest) wordt voor alle vier de tabellen
daadwerkelijk geweigerd (`UPDATE 0`/`INSERT 0 0`, 0 rijen
`RETURNING`, de bio/opmerking blijft op de vorige waarde staan, er
wordt geen nieuwe message/post-rij aangemaakt) én levert precies één rij
op in `flagged_content` met het juiste `source_table`/`matched_words`;
`authenticated` kan `content_filter_words` noch `flagged_content` direct
uitlezen, maar wel `find_flagged_words()` aanroepen. `npx tsc --noEmit`
blijft schoon na het omzetten van alle vijf de aanroeppunten (inclusief
`MatchScreen.tsx`, een eerder gemiste aanroepplek - zie hieronder), en
een `expo export`-bundel bevat de nieuwe "Ongepaste taal"-melding en
geen spoor meer van de oude "toch versturen"-dialoog.

**Bijvangst tijdens deze wijziging**: `MatchScreen.tsx` (het
"CONNECTIE!"-scherm met het invoerveld voor het allereerste bericht na
een match) riep `sendMessage()` altijd al rechtstreeks aan, zonder ooit
door `checkContentFilter()` te zijn gegaan - een aparte aanroepplek naast
`ChatDetailScreen.tsx`'s `onSend`, gemist bij de oorspronkelijke
implementatie in `0027`. Nu ook aangekoppeld.

## Moderatie-overzicht

Basaal moderatiescherm, ter voorbereiding op Apple's App Store Review
Guideline 1.2 (binnen 24 uur kunnen reageren op gerapporteerde/gemarkeerde
content). Alleen toegankelijk voor één account
(`floris.reinders@gmail.com`) - een e-mailadres-check, bewust geen
rollen-tabel/systeem (dit project heeft nog geen ander gebruik voor
rollen, en één hardcoded adres is eenvoudiger te auditen dan een tabel
met precies één rij).

**Toegang - twee lagen, met verschillende sterkte**:

1. **Client-side (UX, geen beveiliging)**: `constants/moderator.ts`
   exporteert `MODERATOR_EMAIL` - de enige plek in de app waar dit adres
   staat. `SettingsScreen.tsx` toont de "Moderatie"-rij alleen wanneer
   `session.user.email === MODERATOR_EMAIL`; voor elk ander account
   bestaat de ingang eenvoudigweg niet ("verborgen/beperkte route" uit de
   opdracht). `ModerationScreen.tsx` zelf checkt hetzelfde nog eens en
   toont "Geen toegang" als iemand de route toch weet te raden/forceren.
2. **Database (de echte grens)**: `public.is_moderator()`
   (`0029_moderation_dashboard.sql`) is de enige plek waar dit adres
   *server-side* staat - een `security definer`-functie die `auth.users`
   opzoekt via `auth.uid()` (nodig omdat `authenticated` zelf geen
   toegang tot `auth.users` heeft) en vergelijkt met het hardcoded adres.
   Elke RLS-policy hieronder roept deze functie aan, dus zelfs een
   client die de check in stap 1 volledig overslaat (gewijzigde app,
   directe API-aanroep) krijgt gewoon niets terug.

**RLS-policies** (permissive - ze voegen toe aan de bestaande policies,
nemen niets weg bij een gewone gebruiker):
- `reports`: "Moderator can view all reports" (SELECT, alle rapportages,
  niet alleen de eigen rapportages van `0012_moderation_reports_blocks.sql`)
  en "Moderator can update reports" (UPDATE, voor de "Afgehandeld"-knop).
- `flagged_content`: "Moderator can view flagged content" (SELECT) - deze
  tabel had sinds `0027_content_filter.sql` bewust **geen enkele**
  policy (ook de gemarkeerde gebruiker zelf kon zijn eigen rijen niet
  zien); dit is de eerste keer dat iemand dit via de app kan lezen.

**Het scherm** (`app/settings/ModerationScreen.tsx`) toont twee lijsten:
- Openstaande rapportages (`status in ('open', 'reviewing')`) met
  melder, gerapporteerde gebruiker, reden, details, tijdstip
  (`fetchOpenReports()`, `lib/api.ts`).
- De 50 meest recente `flagged_content`-rijen: gebruiker, brontabel,
  getriggerde woord(en), tijdstip (`fetchRecentFlaggedContent()`).

Twee acties, elk met een paar tikken:
- **"Afgehandeld"** op een rapportage → `resolveReport()` zet `status`
  op `'resolved'` (bestaande waarde uit `0012`'s check-constraint, geen
  nieuwe status nodig).
- **"Verwijder gebruiker"** (op zowel een rapportage- als een
  flagged_content-rij) → hergebruikt de bestaande
  account-verwijderfunctionaliteit: `deleteAccount(userId)`
  (`lib/auth.ts`) roept dezelfde `delete-account` Edge Function aan als
  "Account verwijderen" in Instellingen, nu met een optionele
  `target_user_id` in de request body. De Edge Function checkt zelf
  (opnieuw, via de JWT van de aanroeper - niet via wat de request body
  beweert) `is_moderator()` voordat een `target_user_id` die niet de
  aanroeper zelf is, wordt gehonoreerd; zie de uitgebreide comment
  bovenaan `supabase/functions/delete-account/index.ts`. Er is geen
  aparte "schorsen" (tijdelijk) geïmplementeerd - de opdracht vroeg
  expliciet om de bestaande verwijderfunctionaliteit te hergebruiken
  "indien mogelijk", en permanent verwijderen is wat er al bestond.

Draai `0029_moderation_dashboard.sql` op je bestaande database -
`0001_init.sql` is ook bijgewerkt voor nieuwe installaties. Deploy
daarna de bijgewerkte Edge Function opnieuw (`supabase functions deploy
delete-account`) - anders blijft "Verwijder gebruiker" in het
moderatie-overzicht een "Geen toegang"-fout geven, ook al is de
database-kant klaar. Controleer na het draaien van de migratie met:

```sql
select
  (select count(*) from pg_proc where proname = 'is_moderator' and pronamespace = 'public'::regnamespace) as has_is_moderator,
  has_function_privilege('authenticated', 'public.is_moderator()', 'execute') as authenticated_can_call,
  (select count(*) from pg_policies where tablename = 'reports' and policyname = 'Moderator can view all reports') as reports_select_policy,
  (select count(*) from pg_policies where tablename = 'reports' and policyname = 'Moderator can update reports') as reports_update_policy,
  (select count(*) from pg_policies where tablename = 'flagged_content' and policyname = 'Moderator can view flagged content') as flagged_select_policy;
-- verwacht: 1, true, 1, 1, 1
```

De migratie zelf bevat ook een zelfcontrolerend `do $$ ... $$`-blok
onderaan (zelfde aanpak als `0022`-`0028`) dat bij het draaien zelf al
een specifieke `EXCEPTION` opwerpt zodra iets hiervan niet klopt.

**Getest**: lokaal (los Postgres-schema met minimale stand-ins voor
`auth.users`/`profiles`/`reports`/`flagged_content`, geen netwerktoegang
tot Supabase vanuit deze omgeving) - de migratie draait idempotent;
`is_moderator()` geeft `true` voor het moderator-e-mailadres en `false`
voor elk ander account; de moderator kan alle rapportages lezen (niet
alleen de eigen) én de status bijwerken; een gewone gebruiker (de
melder) kan nog steeds alleen zijn eigen rapportage lezen (de
pre-existing `0012`-policy blijft ongewijzigd werken) maar kan die
**niet** updaten (`UPDATE 0`, RLS weigert het stil); de gerapporteerde
gebruiker zelf ziet 0 rapportages; de moderator kan `flagged_content`
lezen, een gewone/gemarkeerde gebruiker ziet daar nog steeds 0 rijen
(ongewijzigd tov. `0027`); een onbevoegde/niet-ingelogde rol (`anon`)
ziet 0 rijen in beide tabellen. `npx tsc --noEmit` blijft schoon, en een
`expo export`-bundel bevat de nieuwe schermtekst en precies één
voorkomen van het moderator-e-mailadres (bevestigt dat
`constants/moderator.ts` de enige bron is, geen losse kopieën die uit
elkaar kunnen lopen). De Edge Function zelf (Deno, buiten `tsc`'s
scope - `supabase/functions/**` staat expliciet in `tsconfig.json`'s
`exclude`) is handmatig nagelopen op de nieuwe
`target_user_id`/`is_moderator()`-tak; een end-to-end test daarvan kan
alleen tegen een echte Supabase-deployment (geen netwerktoegang tot
Supabase vanuit deze omgeving).

### "Moderatie"-rij niet zichtbaar? Exacte plek + de layout-bug die dit veroorzaakte

De rij staat helemaal onderaan Instellingen: onder het "Account"-blok
(Mijn profiel bewerken/E-mail wijzigen/Locatie wijzigen/Abonnement
beheren/Mijn gegevens opvragen), voorbij "Notificatievoorkeuren",
"Privacy" en "Ondersteuning", **na** "Uitloggen" en "Account
verwijderen" - als eigen "Moderatie"-sectie met precies één rij
("Moderatie-overzicht"), vlak boven de (`__DEV__`-only) "Ontwikkelaar"-
sectie.

Twee eerdere, plausibele-maar-onjuiste verklaringen zijn hier al
gehard tegen (blijven nuttig als achtergrond, maar waren niet de
daadwerkelijke oorzaak): `0030_moderator_email_case_insensitive.sql`
maakt `is_moderator()` én de client-side check hoofdletter-ongevoelig
(`select email from auth.users where lower(email) = lower('floris.reinders@gmail.com');`
om je eigen schrijfwijze te checken), en een EAS Update wordt pas
*gedownload* bij het opstarten en pas *toegepast* bij de eerstvolgende
herstart daarna (dus altijd twee keer volledig afsluiten en heropenen
na een nieuwe preview build).

**De daadwerkelijke oorzaak**: `SettingsScreen.tsx` had helemaal geen
`ScrollView` - alle secties stonden in een platte `View`/Fragment
direct in `ScreenContainer`'s `flex: 1`-content-`View`. Zolang het
scherm weinig secties had paste alles nog net binnen de viewport, maar
met de latere toevoeging van de Moderatie-sectie (en de nog steeds in
de bundel aanwezige, alleen verborgen "Mijn trainingen"-rij) werd de
totale inhoud hoger dan het scherm - zonder `ScrollView` is er dan
simpelweg niets om verder te scrollen, en blijft alles voorbij de
zichtbare viewport (deels achter de vast gepositioneerde `BottomNav`,
`position: "absolute"`, zie `components/BottomNav.tsx`) onbereikbaar.
Opgelost door alle secties in een `<ScrollView
contentContainerStyle={styles.scrollContent}>` te wrappen (met
`paddingBottom: BOTTOM_NAV_HEIGHT + spacing.md`, exact hetzelfde
patroon als `MyTrainingsScreen.tsx` en `ModerationScreen.tsx` al
gebruikten) - puur een layout-fix, geen gedragswijziging.

## Scripts

- `npm start` — start de Expo dev server
- `npm run ios` / `npm run android` / `npm run web`
- `npm run typecheck` — TypeScript compileren zonder output
- `npm run sentry:upload-sourcemaps` — upload source maps uit `dist/` naar
  Sentry (zie "Sentry crash-reporting" hierboven) - vereist
  `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` in de environment

## Notities

- Sportfoto's en avatars gebruiken placeholder-URLs (`picsum.photos`, `i.pravatar.cc`)
  totdat gebruikers eigen foto's uploaden naar Supabase Storage.
- Het betaalscherm draait in een sandbox-modus (geen echte betaling) in
  afwachting van een echte RevenueCat-koppeling - zie de "RevenueCat"-sectie
  hierboven.
