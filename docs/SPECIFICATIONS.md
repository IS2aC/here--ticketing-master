# Here! · Spécifications techniques

Document vivant : les fonctionnalités sont ajoutées au fur et à mesure (voir [TODO.md](../TODO.md)).

## Architecture (MVP web)

Tout est dans [web/](../web/README.md) et se déploie sur Dokploy avec un seul `docker-compose.yml` :

| Service | Technologie | Rôle |
|---|---|---|
| `here-db` | PostgreSQL 16 | Données |
| `here-migrate` | dbmate | Applique les migrations SQL au démarrage, avant l'API |
| `here-api` | FastAPI (Python 3.12, SQLAlchemy async + asyncpg) | Seul accès à la base. Routes métier versionnées sous `/v1`, pensées pour être appelées aussi par l'app mobile. `/health` pour la supervision |
| `here-frontend` | Next.js 16 (TypeScript, Tailwind avec le preset de l'identité Here!) | Interface web. Appelle l'API par le réseau interne |
| `here-worker` | Même image que l'API (`python -m app.worker`) | Envoi WhatsApp des invitations et relances, un invité à la fois. **Un seul par numéro WhatsApp** |

L'API et le frontend ont chacun leur domaine dans Dokploy ; l'app mobile utilisera le domaine de l'API.

## Comptes et connexion

- Inscription : prénom, nom, téléphone (WhatsApp), e-mail facultatif, mot de passe (8 caractères minimum). Le téléphone est ramené au format `+225…` ; un numéro local à 10 chiffres est considéré comme ivoirien.
- Connexion : téléphone **ou** e-mail, et mot de passe. Message d'erreur identique que le compte existe ou non.
- Mots de passe hachés avec Argon2. Sessions dans la table `sessions` : jeton aléatoire remis au client, seule son empreinte SHA-256 est stockée ; 30 jours ; la déconnexion révoque la session.
- Web : le frontend garde le jeton dans un cookie httpOnly et appelle l'API côté serveur. Mobile : le même jeton, envoyé dans `Authorization: Bearer`.

## Événements

- Création (étape 1 de l'assistant « L'événement ») : type (11 types de la maquette + « Autre »), nom, date et heure, lieu et adresse, invités prévus, durée, dress code, description, catégories d'invités (VIP et Normal par défaut, 1 à 10, sans doublon). Seuls le type, le nom et la date sont obligatoires ; la date doit être à venir.
- Un événement créé est un **brouillon**. Il n'est visible que par son organisateur (un autre compte reçoit « introuvable »).
- Vue de l'événement : compteurs Invités / Confirmés / En attente / Déclinés, catégories avec leur nombre d'invités, informations de l'événement. Prochaine étape : l'import de la liste.
- Modification : mêmes champs. Une catégorie qui a déjà des invités ne peut pas être retirée.
- Dates saisies et affichées à l'heure d'Abidjan (UTC+0), stockées en UTC.

## Import de la liste d'invités

- Fichier Excel (.xlsx) ou CSV (séparateur `;` ou `,`, UTF-8 ou Windows), 5 Mo et 5 000 invités maximum. Un modèle Excel est téléchargeable.
- Colonnes, dans n'importe quel ordre, titres reconnus sans tenir compte des accents ni de la casse (une ligne de titre peut précéder l'en-tête) :

  | Colonne | Règle | Titres reconnus (exemples) |
  |---|---|---|
  | Nom | Obligatoire, ou les prénoms | Nom, Nom de famille |
  | Prénoms | Obligatoire, ou le nom | Prénom, Prénoms, Prénom(s) |
  | Numéro | Facultatif | Numéro, Téléphone, Tél, WhatsApp, Contact |
  | Catégorie | Facultatif, « Normal » par défaut | Catégorie, Groupe |
  | Position | Facultatif : table ou place | Position, Table, Place |

- Deux temps : le fichier est d'abord **lu et vérifié** (aperçu, rien n'est ajouté), puis l'organisateur **confirme**. Un nouvel aperçu remplace le précédent ; après confirmation, les lignes du fichier ne sont pas conservées.
- Vérification de chaque ligne :

  | Statut | Importée ? |
  |---|---|
  | Prêt | Oui |
  | Numéro manquant | Oui (invitation impossible tant qu'il manque) |
  | Numéro incomplet | Oui, gardé tel quel et signalé « à vérifier » |
  | Nom manquant | Non |
  | Catégorie inconnue de l'événement | Non : créer la catégorie ou corriger le fichier, puis réimporter |
  | Déjà dans la liste (même numéro, ou même nom sans numéro) | Non, retiré automatiquement |

- Numéros ramenés au format `+225…`, y compris quand Excel a supprimé le 0 initial d'un numéro saisi comme nombre. La catégorie « Normal » est créée si elle n'existe pas encore dans l'événement.
- Liste des invités sur la vue de l'événement : numéros masqués (`07 •• •• 34 56`), numéros à vérifier en tête.

## Cartes d'invitation

- **Une carte par type d'événement**, générée automatiquement : pas d'éditeur. La bibliothèque (`/tableau-de-bord/cartes`) montre les 12 cartes, sur les 5 modèles de l'identité :

  | Modèle | Types |
  |---|---|
  | Cérémonie (ivoire et or, Playfair) | Mariage, Dot, Baptême |
  | Rendez-vous (rouge Here, pictogramme) | Anniversaire, Brunch, Retrouvailles, Autre |
  | Officiel (blanc, bandeau noir) | Réunion, Séminaire |
  | Soirée (nuit, slash rouge) | Concert privé, Festival |
  | Hommage (pierre, sobre, aucun rouge) | Funérailles |

- Contenu : type, formule propre au type, nom de l'événement (titre), nom de l'invité, date, heure, durée, lieu, dress code, message de fin.
- **Sceau Here!** en pied de chaque carte, non modifiable : QR code unique, « Invitation personnelle », nom de l'invité, nombre de personnes, catégorie et position (en petit), symbole « ! », « Invitation vérifiée par Here! », code `INV-XXXX-XXXX` (dérivé du jeton sans le révéler). Monochrome sur la carte Hommage.
- Étape 3 « La carte » : aperçu pour l'invité choisi, puis « Préparer les cartes » : une invitation (jeton aléatoire de 32 caractères) par invité qui n'en a pas. Rien n'est envoyé.
- Image PNG 1080 × 1350 (4:5, optimal dans WhatsApp), publique à `/i/<jeton>/carte.png` ; le QR code mène à la page invité `/i/<jeton>`.

## Page invité

Web mobile, sans compte ni application : le jeton de l'adresse (`/i/<jeton>`, aussi porté par le QR code) est la seule clé. Textes en 17 px minimum, boutons de 56 px. Maquettes `mobile-invite`, `mobile-invite-qr`, `mobile-invite-reponse-non`.

- **Question** : bandeau aux couleurs de la carte, « Bonjour <invité>, Serez-vous des nôtres ? » (« Pourrez-vous venir ? » pour un hommage), « Oui, je serai là / nous serons là » et « Non, je ne pourrai pas / nous ne pourrons pas venir ». Sélecteur de personnes si l'invitation compte plusieurs places, plafonné à ce nombre. Date, durée, lieu avec « Itinéraire », tenue, « Ajouter à mon agenda » (fichier .ics avec rappel la veille), lien vers la carte.
- **Présent** : écran sombre « Votre présence est confirmée », QR code d'entrée de 220 px avec le symbole Here!, nom, personnes, table, code, « Présentez ce code à l'entrée », « Modifier ma réponse ».
- **Absent** : « Merci pour votre réponse » (« La famille vous remercie » pour un hommage), date jusqu'à laquelle on peut changer d'avis, mot facultatif pour l'hôte, « Finalement, je viendrai » (le mot déjà laissé est gardé).
- **Réponses closes** au début de l'événement ou s'il est annulé ; un invité confirmé garde son QR code d'entrée.
- Côté organisateur : statut, nombre de personnes et mot de l'invité dans la liste ; compteurs mis à jour. « Votre réponse n'est vue que par les mariés / la famille / l'organisateur » selon le type.

## Envoi WhatsApp : invitations et relances (étape 4)

Prestataire : **WasenderAPI** (session WhatsApp reliée comme appareil connecté, pas l'API officielle de Meta). Le reste de l'application ne connaît qu'un connecteur interchangeable (`app/whatsapp`, variable `WHATSAPP_PROVIDER`) :

| `WHATSAPP_PROVIDER` | Effet |
|---|---|
| `console` (défaut) | Rien n'est envoyé : les messages sont écrits dans les journaux du worker. Développement et tests |
| `wasender` | Envoi réel. Demande `WASENDER_API_KEY` (clé de la session) et `WASENDER_WEBHOOK_SECRET` |

### Ce que reçoit l'invité (maquette `mobile-message`)

1. **La carte** en image (`/i/<jeton>/carte.png`, publique), avec une légende : « Bonjour <invité>, voici votre invitation pour « <événement> », le <date> à <heure>, <lieu>. Votre carte et votre réponse : » puis le lien de la page invité sur sa propre ligne.
2. **Relance** : texte « Nous n'avons pas encore votre réponse… » + lien.
3. **Hommage** (funérailles) : texte sobre au nom de la famille.

**Pas de sondage** (décision du 29/10) : un seul message par invité, la carte et le lien. L'invité répond sur sa page. Moitié moins de messages, donc moins de risque de buter sur la limite de débit du prestataire. Les votes aux sondages envoyés avant cette décision restent enregistrés (webhook `poll.results`). Une réponse sur la page annule les relances encore en file.

### Envoi (organisateur, `/tableau-de-bord/evenements/<id>/relances`)

- « Envoyer N invitations » met en file l'invitation de chaque invité qui a sa carte et un numéro valide, et ne l'a pas encore reçue. Le premier envoi fait passer l'événement de brouillon à actif. Une invitation en échec peut être renvoyée.
- **Relance standard, offerte** (`events.whatsapp_reminders_enabled`, cochée par défaut) : une relance **7 jours avant l'événement** aux invités sans réponse. Ce calendrier proposé est paramétrable (`WHATSAPP_REMINDER_DAYS_BEFORE`, en jours avant l'événement, par exemple `14,7,2`) et suit la date de l'événement.
- **Dates de relance choisies par l'organisateur** (`events.reminder_dates`, décision du 29/10 : gratuites pendant la phase de test) : sur la page Relances, l'organisateur ajoute ou retire des dates (5 au maximum), ou revient au calendrier proposé (`NULL` en base). Une nouvelle date doit être à venir et au plus tard la veille de l'événement ; une date déjà enregistrée peut rester même si elle est passée, ou se retrouve après l'événement quand celui-ci est avancé (elle est alors signalée et ignorée).
- Une relance part **dès 8 h** le jour prévu (début des heures d'envoi), **seulement aux invités qui n'ont pas encore répondu**, si leur invitation est partie avant ce moment, et jamais dans les 24 h avant l'événement. Si la relance proposée (J-7) est déjà passée, l'écran le dit et invite à choisir une autre date.
- **Relances à la demande** (« Relancer maintenant ») : **option payante**, désactivée (`WHATSAPP_ON_DEMAND_REMINDERS=false`) : le bouton n'apparaît pas et l'API répond 403. Plus tard : activée compte par compte depuis le portail admin (voir TODO).
- **Appels de la conseillère** (`events.call_reminders_enabled`) : 2 jours (`WHATSAPP_CALL_DELAY_DAYS`) après la dernière relance restée sans réponse, un appel est programmé (table `calls`) et l'invité passe en « Appel prévu ».
- Suivi : invitations et relances envoyées, lues, en file, en échec ; derniers messages ; messages libres des invités.

### Cadence anti-blocage (worker)

WasenderAPI ne ralentit pas les envois : c'est le worker qui protège le numéro.

| Règle | Valeur par défaut | Variable |
|---|---|---|
| Un invité à la fois (un seul message : la carte et le lien) | — | — |
| Pause entre deux invités | 20 à 45 s, aléatoire | `WHATSAPP_MIN_DELAY_SECONDS`, `WHATSAPP_MAX_DELAY_SECONDS` |
| Longue pause | 30 min tous les 25 invités | `WHATSAPP_BATCH_SIZE`, `WHATSAPP_BATCH_PAUSE_MINUTES` |
| Heures d'envoi (Abidjan) | 8 h – 20 h | `WHATSAPP_SEND_START_HOUR`, `WHATSAPP_SEND_END_HOUR` |
| Relances automatiques | 7 jours avant l'événement (offerte) | `WHATSAPP_REMINDER_DAYS_BEFORE` |
| Appel après la dernière relance | 2 jours | `WHATSAPP_CALL_DELAY_DAYS` |
| Relances à la demande (payantes) | désactivées | `WHATSAPP_ON_DEMAND_REMINDERS` |

Soit environ 30 invités par heure : 300 invitations prennent une dizaine d'heures d'envoi. Erreur passagère (réseau, 429, 5xx) : nouvel essai 5, 10, 15… min plus tard, 5 essais au maximum. Erreur définitive : message en échec et invité « Injoignable ».

### Webhooks WasenderAPI

À déclarer dans le tableau de bord WasenderAPI (session › Webhook) : `https://<api>/v1/webhooks/wasender`, avec le secret `WASENDER_WEBHOOK_SECRET` (vérifié dans l'en-tête `X-Webhook-Signature`), événements `messages.update`, `poll.results`, `messages.received`.

| Événement | Effet |
|---|---|
| `messages.update` | Statut du message : envoyé, livré, lu (ne recule jamais), échec |
| `poll.results` | Vote à un sondage envoyé avant le 29/10 → réponse de l'invité |
| `messages.received` | Message libre de l'invité (`inbound_messages`), rattaché à l'invité de ce numéro le plus récemment contacté |

L'envoi renvoie un `msgId` interne à WasenderAPI ; les webhooks utilisent l'identifiant WhatsApp (`key.id`). Le worker lit ce dernier avec `GET /messages/{msgId}/info` et le stocke (`messages.whatsapp_id`, `messages.poll_whatsapp_id`).

### Production

- `PUBLIC_APP_URL` doit être l'adresse **publique https** du site : WasenderAPI télécharge l'image de la carte à cette adresse, et le lien envoyé y mène.
- L'API doit être joignable en https pour les webhooks.
- Un seul conteneur `here-worker` par numéro WhatsApp. Plusieurs numéros (pour aller plus vite) : à prévoir (voir TODO).

## Base de données

PostgreSQL 15 ou plus. Schéma visuel : [base-de-donnees.excalidraw](base-de-donnees.excalidraw). Source de vérité : les migrations SQL de [web/db/migrations](../web/db/migrations) (la première, `20261025000000_schema_v1.sql`, crée ce schéma).

### Tables

| Domaine | Table | Rôle |
|---|---|---|
| Comptes | `users` | Organisateurs, support, admins. Connexion par téléphone ou email + mot de passe. |
| | `sessions` | Connexions actives (jeton haché, expiration, révocation). |
| Événement | `events` | Événement d'un organisateur : titre, type, date, durée, lieu, nombre d'invités, dress code, activation des relances WhatsApp et des appels, dates de relance choisies. |
| | `guest_categories` | Catégories d'invités propres à l'événement (VIP, Normal…). |
| | `guest_imports` | Historique des fichiers Excel/CSV importés : correspondance des colonnes, lignes importées et en erreur. |
| Cartes | `card_templates` | Les cinq modèles (Cérémonie, Rendez-vous, Officiel, Soirée, Hommage). Plus tard : modèles importés par un organisateur. |
| | `event_cards` | Carte configurée pour un événement, par catégorie ou par défaut (`category_id` null). |
| | `invitations` | Carte générée pour un invité (1–1), avec le jeton unique du lien invité et du QR code. |
| Invités | `guests` | Invité : nom affiché, téléphone, catégorie, nombre de places, réponse et état des relances. |
| Relances | `messages` | Messages WhatsApp (invitation, relance) : file d'envoi, texte envoyé, identifiants WasenderAPI et WhatsApp (carte, et sondage pour les messages envoyés avant le 29/10), statut. |
| | `inbound_messages` | Messages écrits par les invités sur WhatsApp, à traiter par la conseillère. |
| | `calls` | Appels de l'équipe support : agent, date prévue, résultat, notes. |

### Relations

- Un utilisateur crée plusieurs événements ; un événement a plusieurs catégories, imports, cartes et invités.
- Un invité appartient à une catégorie **du même événement** (clé étrangère composée `(category_id, event_id)`), et éventuellement à un import (null = ajout manuel).
- Une carte d'événement utilise un modèle ; il y a au plus une carte par catégorie et une seule carte par défaut par événement.
- Un invité a une invitation, plusieurs messages et plusieurs appels.

### Statuts affichés dans le tableau de bord

Les six statuts du design se déduisent de deux colonnes de `guests` :

| Statut affiché | Calcul |
|---|---|
| Confirmé / Décliné | `rsvp_status` = `confirmed` / `declined` |
| En attente | `rsvp_status = pending` et `contact_status = none` |
| Relancé / Appel prévu | `rsvp_status = pending` et `contact_status` = `reminded` / `call_scheduled` |
| Injoignable | `contact_status = unreachable` |

### Règles

- Téléphones des utilisateurs au format E.164 (`+225…`), vérifié en base. Les téléphones des invités sont stockés tels qu'importés, avec `phone_valid` pour signaler ceux à corriger.
- Un même numéro ne peut figurer qu'une fois par événement.
- Le jeton d'invitation est aléatoire et long : il ne doit pas permettre de deviner les autres invitations.
- À vérifier côté application : la carte (`event_card_id`) d'une invitation appartient au même événement que l'invité.
- Plus tard, sans modifier l'existant : `otp_codes` (OTP WhatsApp), `scan_links` et `checkins` (scan à l'entrée).

## Scan à l'entrée (contrôle d'accès)

Maquettes : `mobile-scan.html`, `mobile-scan-deja-entre.html`, `mobile-scan-inconnu.html` dans `uiux/visual-identity/mockups/`.

### Liens de scan (organisateur, page « Contrôle d'accès »)

- L'organisateur crée un **lien de scan** par entrée ou par agent (« Porte A », « Entrée de la réception »), le copie et le partage à ses agents d'accueil.
- Le lien (`/scan/<jeton>`, jeton long et aléatoire) s'ouvre sur **n'importe quel smartphone**, dans le navigateur, sans application ni compte.
- Il ne donne que le droit de vérifier une invitation et d'enregistrer une entrée : ni tableau de bord, ni numéros de téléphone, ni liste complète des invités (recherche par nom : 2 lettres au moins, 20 résultats au plus).
- Désactivable à tout moment ; il expire de lui-même **12 h après la fin prévue** de l'événement.
- Nombre d'entrées par lien et total des invitations scannées.

### Écran de scan (agents)

- En-tête : nom de l'événement, nom du lien, compteur « arrivés / attendus » (personnes ; les invités qui ont décliné ne sont pas attendus).
- Caméra arrière et lecture du QR code dans le navigateur (jsQR). Le QR code de la carte contient l'adresse de la page invité ; le code imprimé (`INV-XXXX-XXXX`) peut être saisi à la main ; « Chercher par nom » si la carte est absente ou illisible.
- **L'entrée est enregistrée dès la vérification** (heure, lien). Résultats, couleur du cadre et de l'encadré :

  | Résultat | Couleur | Contenu |
  |---|---|---|
  | Invité attendu | vert | nom, catégorie et table, code, heure ; avertissement si l'invité avait décliné |
  | Déjà entré à HH:MM | ambre | nom, personnes, lien de la première entrée |
  | Invitation non reconnue | rouge | code lu, « Chercher par nom » |

- « Accueillir le suivant » relance la lecture. Un même QR code ne permet d'entrer **qu'une fois**, même si deux agents le scannent en même temps (contrainte unique en base).
- La caméra n'est accessible qu'en **https** (ou sur localhost) : c'est le cas en production derrière Dokploy.
