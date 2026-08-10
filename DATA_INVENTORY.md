# Data-inventaris: persoonsgegevens in Sportfrend

Dit document geeft een volledig overzicht van welke persoonsgegevens Sportfrend verzamelt en opslaat, waar (Supabase-database, Supabase Storage, Supabase Auth), hoe lang, en welke externe diensten deze gegevens ook verwerken. Het is gebaseerd op het huidige schema (`supabase/migrations/0001_init.sql` t/m `0014_discover_profiles_location_privacy.sql`) en de code die daadwerkelijk naar deze tabellen schrijft/leest.

**Dit is een technische inventaris, geen juridisch document.** Voor een AVG/GDPR-verwerkersregister, verwerkersovereenkomsten met Supabase/Resend/Expo/RevenueCat, en een officiële bewaartermijnenbeleid is juridisch advies nodig - dit document is bedoeld als de feitelijke basis daarvoor.

Laatst bijgewerkt: bij de migratie die exacte locatiegegevens afschermt (zie §5) - `0014_discover_profiles_location_privacy.sql`.

Gebruikers kunnen zelf een overzicht van (vrijwel) alle onderstaande gegevens opvragen via **Instellingen → "Mijn gegevens opvragen"** - zie README.md §"Mijn gegevens opvragen (recht op inzage/dataportabiliteit)" en `lib/dataExport.ts`.

---

## 1. Supabase Auth (`auth.users`)

Buiten de eigen tabellen om beheert Supabase Auth zelf al persoonsgegevens - dit is de identiteitsbron waar `profiles.id` naar verwijst (`on delete cascade`).

| Gegeven | Gevoelig? | Bewaartermijn |
|---|---|---|
| E-mailadres | Persoonsgegeven | Tot accountverwijdering |
| Wachtwoord (gehasht, nooit leesbaar door de app) | Gevoelig (credential) | Tot accountverwijdering |
| Sessie-/refresh-tokens | Gevoelig (credential) | Tot uitloggen of verlopen |
| Aanmaakdatum, laatste inlogtijd (Supabase-interne velden) | Persoonsgegeven | Tot accountverwijdering |

Wordt volledig verwijderd door **"Account verwijderen"** in Instellingen (`supabase/functions/delete-account`), via `auth.admin.deleteUser()`. Omdat `profiles.id references auth.users(id) on delete cascade`, cascadeert die ene verwijdering automatisch door naar alle tabellen hieronder.

---

## 2. Tabellen in `public`

### `profiles`

Eén rij per gebruiker; bevat het overgrote deel van de persoonsgegevens in de app.

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `full_name` | Ja | - | Tot accountverwijdering of handmatige wijziging |
| `birthdate` | Ja (herleidbaar tot leeftijd, geboortedatum) | Ja | Tot accountverwijdering |
| `gender` | Ja | Ja | Tot accountverwijdering of handmatige wijziging |
| `bio` | Ja (vrije tekst, kan alles bevatten) | Potentieel | Tot accountverwijdering of handmatige wijziging |
| `sport`, `level` | Ja (voorkeuren) | - | Tot accountverwijdering of handmatige wijziging |
| `city` | Ja | Ja (locatie) | Tot accountverwijdering of handmatige wijziging |
| `latitude`, `longitude` | Ja, **exacte GPS-coördinaten** | **Ja, hoog gevoelig** | Tot accountverwijdering of handmatige wijziging - zie §5. Sinds `0014_discover_profiles_location_privacy.sql` **niet meer rechtstreeks uitleesbaar door wie dan ook**, ook niet de eigenaar zelf via een gewone kolom-select - alleen via `get_my_location()` (eigen rij) of als berekende `distance_km` via `discover_profiles()` voor anderen. |
| `search_radius_km` | Nee (instelling, geen persoonsgegeven op zich) | - | - |
| `avatar_url`, `photo_url` | Ja (foto van de gebruiker) | Ja (biometrisch-achtig beeldmateriaal) | Zie §3 (Storage) - oude foto's blijven staan tot accountverwijdering |
| `is_onboarded`, `profile_visible`, `push_notifications_enabled`, `availability_days` | Nee (app-instellingen) | - | - |
| `expo_push_token` | Ja (apparaat-identifier) | Ja - zie §5 | Tot accountverwijdering of nieuwe registratie (wordt overschreven) |
| `created_at`, `updated_at` | Metadata | - | Tot accountverwijdering |

RLS + kolomrechten: elke rij is leesbaar door alle ingelogde gebruikers **behalve** `expo_push_token` en `latitude`/`longitude` (beide kolom-niveau geblokkeerd voor de `authenticated`-rol, alleen bereikbaar via de `SECURITY DEFINER`-functies hierboven) en behalve wanneer er een blokkade bestaat of `profile_visible = false` (dan alleen zichtbaar voor de eigenaar zelf of een bestaande match). Zie `supabase/migrations/0013_rls_security_audit_fixes.sql` en `0014_discover_profiles_location_privacy.sql`.

### `swipes`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `swiper_id`, `swiped_id` | Ja (wie heeft naar wie gekeken/geswiped) | Matig - onthult interesse/afwijzing | Tot accountverwijdering van swiper of swiped - geen eigen verwijderfunctie in de app |
| `direction` (`like`/`skip`) | Ja | Matig | idem |

Nooit rechtstreeks leesbaar voor de andere partij (behalve een gerichte 'like', nodig om een match te kunnen detecteren) - een 'skip' is alleen zichtbaar voor wie hem gaf.

### `matches`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_a_id`, `user_b_id` | Ja (wie is met wie gematcht) | Matig | Tot handmatig verwijderd ("Vriend verwijderen") of accountverwijdering |

### `messages`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `sender_id` | Ja | - | Tot verwijdering van het bijbehorende match of accountverwijdering |
| `body` | Ja, **kan alle inhoud bevatten die gebruikers uitwisselen** | Potentieel hoog (afhankelijk van inhoud) | idem - geen aparte verwijderfunctie per bericht |
| `created_at`, `read_at` | Metadata | - | idem |

Berichttekst (eerste 120 tekens) verlaat de eigen infrastructuur richting Expo's push-API bij het versturen van een pushmelding - zie §4.

### `posts` / `post_likes`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `author_id`, `body`, `image_url`, `sport`, `event_date` | Ja (openbare community-post) | - (bewust publiek zichtbaar voor alle ingelogde gebruikers) | Tot de auteur het bericht zelf verwijdert (sinds commit `1702eaa`) of accountverwijdering |
| `post_likes.user_id` | Ja (wie heeft wat geliked, publiek zichtbaar) | - | Tot unliken of accountverwijdering |

### `reports`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `reporter_id`, `reported_id` | Ja | Ja (moderatiegegeven over een derde) | Tot accountverwijdering van reporter of reported - **geen verwijder-/intrekfunctie**, bewust (voorkomt manipuleren van bewijs) |
| `reason`, `details` | Ja, kan gevoelige beschuldigingen bevatten | Ja | idem |
| `status` | Nee (moderatie-workflow) | - | - |

Alleen de melder zelf kan zijn eigen rapportages lezen; er is geen moderator-rol/dashboard in de app zelf (moderatie gebeurt nu via directe databasetoegang met de service-role key).

### `blocks`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `blocker_id`, `blocked_id` | Ja | Matig | Tot accountverwijdering - RLS staat wel een DELETE toe (voorbereid op een toekomstige "deblokkeren"-functie), maar die UI bestaat nog niet |

### `subscriptions`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id`, `plan`, `status`, `price_cents`, `current_period_end` | Ja (financiële/abonnementsgegevens) | Ja (financieel) | Tot accountverwijdering - geen betalingsgegevens (kaartnummers e.d.) worden hier of elders in de eigen database opgeslagen |

### `support_requests`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id`, `subject`, `message` | Ja, vrije tekst | Potentieel (afhankelijk van inhoud) | Tot accountverwijdering - geen eigen verwijderfunctie |

---

## 3. Supabase Storage (`profile-photos`-bucket)

| Gegeven | Gevoelig | Bewaartermijn |
|---|---|---|
| Profielfoto's, pad `{user_id}/{timestamp}.{ext}` | Ja (beeldmateriaal van de gebruiker) | **Elke upload krijgt een nieuw bestand; de vorige foto wordt niet automatisch verwijderd** - oude foto's blijven dus staan totdat het hele account verwijderd wordt (`delete-account` ruimt dan de volledige map van die gebruiker op) |

De bucket is publiek leesbaar (`public: true`) - elke URL is opvraagbaar door iedereen die hem kent, ingelogd of niet, zolang het account niet verwijderd is.

---

## 4. Externe diensten die deze gegevens verwerken

| Dienst | Welke gegevens | Doel | Waar gedocumenteerd |
|---|---|---|---|
| **Supabase** (database, auth, storage, edge functions, realtime) | Alle bovenstaande gegevens - dit ís de primaire opslag | Kernfunctionaliteit van de app | - |
| **Resend** (`send-support-email`) | Naam, e-mailadres, gebruikers-ID, onderwerp en volledige tekst van een Klantenservice-bericht | E-mail naar `info.sportfrend@gmail.com` sturen bij een support-aanvraag | README.md §"Klantenservice-e-mail (Resend)" |
| **Expo / EAS** (Push-API, `exp.host`) | Expo push-token, verzendernaam (`full_name`), **eerste 120 tekens van een berichttekst**, of "Je hebt een match met {naam}" | Pushmeldingen bij nieuwe berichten/matches | README.md §"Pushmeldingen (Expo Notifications)" |
| **Expo / EAS** (Update-hosting, `u.expo.dev`) | Geen gebruikersgegevens - alleen de gecompileerde JS-bundle (code, geen userdata) wordt gehost | OTA-updates van de preview build | - |
| **RevenueCat** (nog niet live - sandbox-modus) | **Nog niet van toepassing.** Bij een echte integratie: de gebruikers-ID (als RevenueCat `app_user_id`), aankoopgeschiedenis en abonnementsstatus, gedeeld met Apple/Google's eigen betaalinfrastructuur via de store zelf | Toekomstige verwerking van echte betalingen voor Premium/Elite | README.md §"RevenueCat (Betalen-scherm)", `lib/purchases.ts` |
| **Apple / Google** (locatietoestemming, pushregistratie, toekomstige in-app-aankopen) | Locatietoestemming en pushregistratie lopen via het besturingssysteem zelf; app-storegegevens zodra RevenueCat live gaat | Platform-services | - |

Geen analytics-, crash-reporting- of trackingdiensten (bijv. Sentry, Amplitude, Mixpanel) zijn op dit moment in het project geïntegreerd - geverifieerd via `package.json`.

---

## 5. Specifiek gevoelige gegevens - aandachtspunten

- **Exacte locatie (`profiles.latitude`/`longitude`) - opgelost**: tot `0014_discover_profiles_location_privacy.sql` werd afstand clientside berekend in Ontdekken (`fetchDiscoverProfiles`, `lib/api.ts`), wat ruwe coördinaten van elk profiel naar de client stuurde. Afstandsberekening gebeurt nu volledig server-side in de `discover_profiles()`-Postgres-functie, die alleen een berekende `distance_km` teruggeeft; de kolommen zelf zijn kolom-niveau afgeschermd voor de `authenticated`-rol (ook voor de eigenaar via het normale pad - die leest zijn eigen coördinaten voortaan via `get_my_location()`). Nog steeds de meest privacygevoelige kolom in de database en het verdient nog steeds expliciete aandacht in een privacyverklaring/DPIA, maar niet langer ruw uitleesbaar door andere gebruikers.
- **`expo_push_token`**: sinds de RLS-beveiligingsaudit (`0013_rls_security_audit_fixes.sql`) alleen nog leesbaar voor de service-role, niet meer voor andere gebruikers - eerder kon elke ingelogde gebruiker andermans token uitlezen en daarmee (via Expo's ongeauthenticeerde push-API) willekeurige pushmeldingen naar dat toestel sturen.
- **Berichtinhoud naar Expo's push-API**: de eerste 120 tekens van elk bericht verlaten Supabase's infrastructuur richting `exp.host` bij het versturen van een melding. Gebruikers worden hier nergens expliciet over geïnformeerd in de huidige UI.
- **`reports`/`blocks`**: bevatten per definitie gegevens over een derde (de gerapporteerde/geblokkeerde persoon) die niet door die derde zelf zijn verstrekt - relevant voor een eventueel recht op inzage/verwijdering van die derde persoon, wat lastiger is dan bij gegevens die iemand over zichzelf invult.

---

## 6. Bewaartermijnen - samenvatting

Er is **geen automatische verwijdering/expiratie** op enige tabel (geen TTL, geen cron-job die oude data opruimt). Gegevens blijven staan totdat:

| Actie | Effect |
|---|---|
| Gebruiker verwijdert een match ("Vriend verwijderen") | Verwijdert alleen die `matches`-rij (en daarmee, via RLS, de zichtbaarheid van bijbehorende `messages` - de berichtrijen zelf blijven fysiek bestaan tenzij `on delete cascade` alsnog via een accountverwijdering wordt getriggerd) |
| Gebruiker verwijdert een eigen post | Verwijdert die `posts`-rij en cascadeert naar `post_likes` op die post |
| Gebruiker verwijdert zijn account (Instellingen → "Account verwijderen") | Verwijdert **alles**: `auth.users`-rij → cascadeert naar `profiles` → cascadeert naar `swipes`, `matches`, `messages`, `posts`, `post_likes`, `subscriptions`, `support_requests`, `reports`, `blocks`; plus alle bestanden in `profile-photos/{user_id}/` worden expliciet verwijderd door `delete-account` |

Gegevens waarvoor **geen** verwijderfunctie in de app bestaat, en die dus alleen via accountverwijdering (van zichzelf óf van de tegenpartij) verdwijnen: individuele berichten, swipes, rapportages, blokkades, support-aanvragen, abonnementsgeschiedenis.
