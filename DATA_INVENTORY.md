# Data-inventaris: persoonsgegevens in Sportfrend

Dit document geeft een volledig overzicht van welke persoonsgegevens Sportfrend verzamelt en opslaat, waar (Supabase-database, Supabase Storage, Supabase Auth), hoe lang, en welke externe diensten deze gegevens ook verwerken. Het is gebaseerd op het huidige schema (`supabase/migrations/0001_init.sql` t/m `0028_content_filter_hard_block.sql`) en de code die daadwerkelijk naar deze tabellen schrijft/leest, inclusief `lib/sentry.ts` (crash-reporting, geen migratie) en `lib/contentFilter.ts` (client-side deel van de contentfilter).

**Dit is een technische inventaris, geen juridisch document.** Voor een AVG/GDPR-verwerkersregister, verwerkersovereenkomsten met Supabase/Resend/Expo/RevenueCat/Sentry, en een officiële bewaartermijnenbeleid is juridisch advies nodig - dit document is bedoeld als de feitelijke basis daarvoor.

Laatst bijgewerkt: bij migratie `0028_content_filter_hard_block.sql` (de contentfilter weigert een treffer nu daadwerkelijk in plaats van alleen te markeren) - zie §2 (`flagged_content`).

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
| `birthdate` | Ja (herleidbaar tot leeftijd, geboortedatum) | Ja | Tot accountverwijdering. Verplicht bij registratie; de database weigert (check constraint `profiles_birthdate_min_age_check`, zie `0015_profiles_min_age_check.sql`) elke waarde die op een leeftijd onder de 18 wijst, ongeacht welke client het schrijft. |
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

### `discover_daily_views`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id`, `profile_id`, `view_date` | Ja (welke profielen op welke dag aan wie zijn getoond in Ontdekken) | Beperkt | Tot accountverwijdering - geen eigen verwijderfunctie, en groeit dagelijks (één rij per getoond profiel per dag) sinds migratie `0019_discover_daily_limit.sql` |

Houdt bij hoeveel/welke profielen een gebruiker vandaag al te zien heeft gekregen in Ontdekken, om de dagelijkse aanbevelingslimiet per abonnement (zie §"subscriptions" hieronder) server-side af te dwingen. Alleen leesbaar door de eigenaar zelf (RLS); er is helemaal geen insert/update/delete-policy voor de `authenticated`-rol - elke schrijfactie loopt uitsluitend via de `SECURITY DEFINER`-functie `discover_profiles()`, zodat een gebruiker zijn eigen "al gezien"-historie niet kan resetten of vervalsen om de limiet te omzeilen.

### `matches`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_a_id`, `user_b_id` | Ja (wie is met wie gematcht) | Matig | Tot handmatig verwijderd ("Vriend verwijderen") of accountverwijdering |

### `messages`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `sender_id` | Ja | - | Tot verwijdering van het bijbehorende match of accountverwijdering |
| `body` | Ja, **kan alle inhoud bevatten die gebruikers uitwisselen** | Potentieel hoog (afhankelijk van inhoud) | idem - geen aparte verwijderfunctie per bericht |
| `image_url` | Ja, indien gezet - link naar een door de gebruiker verstuurde foto (sinds migratie `0018_chat_images.sql`), opgeslagen in de publieke Storage-bucket `chat-images` onder `<match_id>/<sender_id>-<timestamp>.<ext>` | Potentieel hoog (afhankelijk van de foto-inhoud) | Bij accountverwijdering wordt het bestand in Storage nu ook expliciet verwijderd (net als profielfoto's, zie `delete-account`); bij het losstaand verwijderen van alléén het match ("Vriend verwijderen") blijft het bestand in Storage wel achter, ook al verdwijnt de berichtrij zelf |
| `created_at`, `read_at` | Metadata | - | idem |

Berichttekst (eerste 120 tekens) verlaat de eigen infrastructuur richting Expo's push-API bij het versturen van een pushmelding - zie §4.

Sinds migratie `0020_messages_daily_limit.sql` telt `created_at` ook mee voor de dagelijkse berichtenlimiet per abonnement (Basis 3/dag, Premium/Elite onbeperkt, zie §"subscriptions"): de "Match participants can send messages"-RLS-policy telt hoeveel rijen deze afzender vandaag al heeft, en weigert een nieuw bericht zodra dat aantal het planlimiet bereikt.

### `trainings`

Sinds migratie `0024_trainings_planner.sql` ("Trainings & Buddy Planner", zie README.md).

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `match_id`, `created_by` | Ja (wie stelt een training voor aan wie) | Matig | Tot verwijdering van het bijbehorende match (`on delete cascade`) of accountverwijdering |
| `date`, `time`, `sport`, `location`, `note` | Ja, indien gezet - wanneer/waar/met wie iemand traint, plus een vrij invulveld (`note`) | Potentieel (`location`/`note` kunnen adres- of andere herleidbare informatie bevatten) | idem |
| `status`, `created_at` | Metadata | - | idem |
| `reminder_sent_at` | Nee (alleen "is de 2-uur-van-tevoren-pushmelding al verstuurd", geen inhoud) | - | idem |

Alleen een actief Elite-abonnement (`has_elite_access()`, zie §"subscriptions") mag een rij *aanmaken* (RLS INSERT-policy) - reageren (accepteren/afwijzen/"voorstel wijzigen") mag elke deelnemer van het match, ongeacht diens eigen plan. `claim_training_reminders()` (alleen aanroepbaar door `service_role`, nooit door een ingelogde gebruiker) stuurt via dezelfde Expo Push API als berichten/matches (§4) een herinnering circa 2 uur voor een geaccepteerde training.

### `posts` / `post_likes`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `author_id`, `body`, `image_url`, `sport`, `event_date` | Ja (community-post) | - (zichtbaar voor de auteur zelf en gebruikers waarmee de auteur een bestaande match heeft, en sinds migratie `0022_posts_premium_only.sql` bovendien alleen voor een viewer met een actief Premium/Elite-abonnement - een Basis-account ziet helemaal geen posts, ook niet zijn eigen oudere; daarvoor publiek zichtbaar voor alle ingelogde gebruikers) | Tot de auteur het bericht zelf verwijdert (sinds commit `1702eaa`) of accountverwijdering |
| `post_likes.user_id` | Ja (wie heeft wat geliked) | - (sinds `0022_posts_premium_only.sql` ook alleen zichtbaar voor Premium/Elite; daarvoor publiek zichtbaar voor alle ingelogde gebruikers) | Tot unliken of accountverwijdering |

### `reports`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `reporter_id`, `reported_id` | Ja | Ja (moderatiegegeven over een derde) | Tot accountverwijdering van reporter of reported - **geen verwijder-/intrekfunctie**, bewust (voorkomt manipuleren van bewijs) |
| `reason`, `details` | Ja, kan gevoelige beschuldigingen bevatten | Ja | idem |
| `status` | Nee (moderatie-workflow) | - | - |

Alleen de melder zelf kan zijn eigen rapportages lezen; er is geen moderator-rol/dashboard in de app zelf (moderatie gebeurt nu via directe databasetoegang met de service-role key).

Sinds migratie `0026_reports_and_support_daily_limits.sql` mag een account maximaal 10 rapportages per dag aanmaken (`can_submit_report_today()`, afgedwongen op de INSERT-policy) - voorheen onbeperkt, een mogelijk intimidatiemiddel (iemand overspoelen met valse meldingen).

### `blocks`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `blocker_id`, `blocked_id` | Ja | Matig | Tot accountverwijdering - RLS staat wel een DELETE toe (voorbereid op een toekomstige "deblokkeren"-functie), maar die UI bestaat nog niet |

### `subscriptions`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id`, `plan`, `status`, `price_cents`, `current_period_end` | Ja (financiële/abonnementsgegevens) | Ja (financieel) | Tot accountverwijdering - geen betalingsgegevens (kaartnummers e.d.) worden hier of elders in de eigen database opgeslagen |

Sinds migratie `0019_discover_daily_limit.sql` is `plan` niet langer alleen informatief: `discover_profiles()` leest deze kolom (alleen een rij met `status = 'active'` telt mee, dus een gekozen-maar-niet-"betaald" `pending`-plan telt als Basis) om de dagelijkse Ontdekken-aanbevelingslimiet te bepalen (Basis 5/dag, Premium 15/dag, Elite onbeperkt). Sinds migratie `0020_messages_daily_limit.sql` geldt hetzelfde voor de dagelijkse berichtenlimiet (Basis 3/dag, Premium/Elite onbeperkt), afgedwongen op de INSERT-policy van `messages`. Sinds migratie `0021_discover_profiles_plan_filters.sql` bepaalt `plan` ook welke Ontdekken-filters bruikbaar zijn (Basis: alleen Sport + Afstand, tot 50km; Premium/Elite: ook Leeftijd en Niveau, Afstand tot 150km) - eveneens afgedwongen binnen `discover_profiles()` zelf. Sinds migratie `0022_posts_premium_only.sql` bepaalt `plan` ook of het "prikbord" (`posts`/`post_likes`) toegankelijk is: alleen een actief Premium- of Elite-abonnement mag posts lezen, plaatsen of liken - een Basis-account ziet niets van deze tabellen, afgedwongen via `has_posts_access()` in de RLS-policies zelf. Sinds migratie `0023_discover_profiles_availability_filter.sql` bepaalt `plan` ook of de "Slimme beschikbaarheids match"-filter (overlap met `profiles.availability_days`) in `discover_profiles()` wordt toegepast: uitsluitend voor een actief Elite-abonnement - voor Basis én Premium wordt de meegestuurde `p_availability_days`-waarde genegeerd. Sinds migratie `0024_trainings_planner.sql` bepaalt `plan` ook of een rij in `trainings` mag worden *aangemaakt* (`has_elite_access()`, uitsluitend een actief Elite-abonnement) - reageren op een al bestaande training is niet aan `plan` gebonden.

### `support_requests`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id`, `subject`, `message` | Ja, vrije tekst | Potentieel (afhankelijk van inhoud) | Tot accountverwijdering - geen eigen verwijderfunctie |

Sinds migratie `0026_reports_and_support_daily_limits.sql` mag een account maximaal 5 klantenservice-aanvragen per dag aanmaken (`can_submit_support_request_today()`, afgedwongen op de INSERT-policy) - voorheen onbeperkt, en elke aanvraag triggert een echte e-mail via Resend (§4), dus onbeperkt misbruik kostte ook echt geld/quota.

### `flagged_content`

| Kolom | Persoonsgegeven | Gevoelig | Bewaartermijn |
|---|---|---|---|
| `user_id` | Ja | Ja (moderatiegegeven) | Tot accountverwijdering - geen eigen verwijderfunctie |
| `source_table`, `source_id`, `matched_words`, `reason`, `status` | Nee (verwijst terug naar de bron-rij; `matched_words` is het/de getriggerde woord(en) uit de lijst, geen los stuk vrije tekst) | Matig | idem |

Sinds migratie `0027_content_filter.sql`: automatische controle wanneer `bio` (`profiles`), een chatbericht (`messages`), een post (`posts`) of een trainingsopmerking (`trainings.note`) een woord uit `content_filter_words` bevat (woordgrens-matching, Nederlands + Engels, scheldwoorden/seksueel-expliciet/haatdragend - zie README.md §"Contentfilter"). Sinds migratie `0028_content_filter_hard_block.sql` wordt de content bij een treffer **daadwerkelijk geweigerd** (niet alleen gemarkeerd) - een `BEFORE INSERT/UPDATE`-trigger annuleert de schrijfactie zelf, dus een rij hier betekent voortaan altijd "geweigerde poging", nooit meer "gepubliceerde-maar-gemarkeerde content". Deze weigering is niet te omzeilen (database-niveau, ongeacht wat de client doet); de `content` zelf staat dus nergens meer opgeslagen bij een treffer, alleen het feit dát er een poging was, met welk(e) woord(en). RLS staat aan zonder policies: zelfs de geweigerde gebruiker zelf kan zijn eigen rijen hier niet lezen (dat zou het triggerende woord weglekken); alleen bedoeld voor een toekomstig moderatie-overzicht via directe service-role-toegang.

`content_filter_words` (de woordenlijst zelf) bevat geen persoonsgegevens - puur beheerde configuratie, geen gebruikersdata, ook zonder policies voor `authenticated` (onzichtbaar voor de client, alleen bereikbaar via de `security definer`-functie `find_flagged_words()`).

---

## 3. Supabase Storage (`profile-photos`- en `chat-images`-buckets)

| Gegeven | Gevoelig | Bewaartermijn |
|---|---|---|
| Profielfoto's, pad `{user_id}/{timestamp}.{ext}` | Ja (beeldmateriaal van de gebruiker) | **Elke upload krijgt een nieuw bestand; de vorige foto wordt niet automatisch verwijderd** - oude foto's blijven dus staan totdat het hele account verwijderd wordt (`delete-account` ruimt dan de volledige map van die gebruiker op) |
| Chatafbeeldingen (`chat-images`-bucket), pad `{match_id}/{sender_id}-{timestamp}.{ext}` (sinds `0018_chat_images.sql`) | Ja (beeldmateriaal dat de gebruiker in een chat verstuurt) | Blijft staan zolang het match bestaat; `delete-account` ruimt bij accountverwijdering alle door die gebruiker geüploade chatafbeeldingen op (in elk match waar diegene deel van was) - het losstaand verwijderen van één match ("Vriend verwijderen") ruimt de bijbehorende afbeeldingen echter niet op |

Beide buckets zijn publiek leesbaar (`public: true`) - elke URL is opvraagbaar door iedereen die hem kent, ingelogd of niet, zolang het bestand niet verwijderd is. Voor `chat-images` is het pad (met een niet te raden `match_id` en timestamp) de facto de enige bescherming tegen willekeurige toegang; wie mag *uploaden* of *verwijderen* wordt wél afgedwongen via RLS-policies op `storage.objects`, die controleren of de aanvrager daadwerkelijk deelnemer is van het match in het pad.

---

## 4. Externe diensten die deze gegevens verwerken

| Dienst | Welke gegevens | Doel | Waar gedocumenteerd |
|---|---|---|---|
| **Supabase** (database, auth, storage, edge functions, realtime) | Alle bovenstaande gegevens - dit ís de primaire opslag | Kernfunctionaliteit van de app | - |
| **Resend** (`send-support-email`) | Naam, e-mailadres, gebruikers-ID, onderwerp en volledige tekst van een Klantenservice-bericht | E-mail naar `info.sportfrend@gmail.com` sturen bij een support-aanvraag | README.md §"Klantenservice-e-mail (Resend)" |
| **Expo / EAS** (Push-API, `exp.host`) | Expo push-token, verzendernaam (`full_name`), **eerste 120 tekens van een berichttekst**, "Je hebt een match met {naam}", of sport/locatie van een geaccepteerde training (herinnering 2 uur van tevoren) | Pushmeldingen bij nieuwe berichten/matches/trainingsherinneringen | README.md §"Pushmeldingen (Expo Notifications)", §"Trainings & Buddy Planner (Elite-only)" |
| **Expo / EAS** (Update-hosting, `u.expo.dev`) | Geen gebruikersgegevens - alleen de gecompileerde JS-bundle (code, geen userdata) wordt gehost | OTA-updates van de preview build | - |
| **RevenueCat** (nog niet live - sandbox-modus) | **Nog niet van toepassing.** Bij een echte integratie: de gebruikers-ID (als RevenueCat `app_user_id`), aankoopgeschiedenis en abonnementsstatus, gedeeld met Apple/Google's eigen betaalinfrastructuur via de store zelf | Toekomstige verwerking van echte betalingen voor Premium/Elite | README.md §"RevenueCat (Betalen-scherm)", `lib/purchases.ts` |
| **Apple / Google** (locatietoestemming, pushregistratie, toekomstige in-app-aankopen) | Locatietoestemming en pushregistratie lopen via het besturingssysteem zelf; app-storegegevens zodra RevenueCat live gaat | Platform-services | - |
| **Sentry** (crash-reporting, `lib/sentry.ts`) | Crash-/foutgegevens: foutmelding + stacktrace, device-model, OS-versie, app-versie/build, scherm-/tik-breadcrumbs vóór de crash. **Geen** IP-adres of andere default-PII (`sendDefaultPii` staat niet aan) en geen gebruikers-ID/e-mailadres - er wordt nergens `Sentry.setUser(...)` aangeroepen | Crashes/onafgehandelde fouten opsporen na lancering | README.md §"Sentry crash-reporting" |

Geen analytics- of trackingdiensten (bijv. Amplitude, Mixpanel) zijn op dit moment in het project geïntegreerd - geverifieerd via `package.json`. Sentry (zie hierboven) is uitsluitend crash-reporting, geen gedragsanalytics.

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
| Gebruiker verwijdert zijn account (Instellingen → "Account verwijderen") | Verwijdert **alles**: `auth.users`-rij → cascadeert naar `profiles` → cascadeert naar `swipes`, `matches`, `messages`, `posts`, `post_likes`, `subscriptions`, `support_requests`, `reports`, `blocks`; plus alle bestanden in `profile-photos/{user_id}/` en alle eigen geüploade chatafbeeldingen in `chat-images/{match_id}/{user_id}-*` (voor elk match van deze gebruiker) worden expliciet verwijderd door `delete-account` |

Gegevens waarvoor **geen** verwijderfunctie in de app bestaat, en die dus alleen via accountverwijdering (van zichzelf óf van de tegenpartij) verdwijnen: individuele berichten, swipes, rapportages, blokkades, support-aanvragen, abonnementsgeschiedenis.
