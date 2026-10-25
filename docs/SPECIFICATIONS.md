# Here! · Spécifications techniques

Document vivant : les fonctionnalités sont ajoutées au fur et à mesure (voir [TODO.md](../TODO.md)).

## Architecture (MVP web)

Tout est dans [web/](../web/README.md) et se déploie sur Dokploy avec un seul `docker-compose.yml` :

| Service | Technologie | Rôle |
|---|---|---|
| `db` | PostgreSQL 16 | Données |
| `migrate` | dbmate | Applique les migrations SQL au démarrage, avant l'API |
| `api` | FastAPI (Python 3.12, SQLAlchemy async + asyncpg) | Seul accès à la base. Routes métier versionnées sous `/v1`, pensées pour être appelées aussi par l'app mobile. `/health` pour la supervision |
| `frontend` | Next.js 16 (TypeScript, Tailwind avec le preset de l'identité Here!) | Interface web. Appelle l'API par le réseau interne |

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

## Base de données

PostgreSQL 15 ou plus. Schéma visuel : [base-de-donnees.excalidraw](base-de-donnees.excalidraw). Source de vérité : les migrations SQL de [web/db/migrations](../web/db/migrations) (la première, `20261025000000_schema_v1.sql`, crée ce schéma).

### Tables

| Domaine | Table | Rôle |
|---|---|---|
| Comptes | `users` | Organisateurs, support, admins. Connexion par téléphone ou email + mot de passe. |
| | `sessions` | Connexions actives (jeton haché, expiration, révocation). |
| Événement | `events` | Événement d'un organisateur : titre, type, date, durée, lieu, nombre d'invités, dress code, activation des relances WhatsApp et des appels. |
| | `guest_categories` | Catégories d'invités propres à l'événement (VIP, Normal…). |
| | `guest_imports` | Historique des fichiers Excel/CSV importés : correspondance des colonnes, lignes importées et en erreur. |
| Cartes | `card_templates` | Les cinq modèles (Cérémonie, Rendez-vous, Officiel, Soirée, Hommage). Plus tard : modèles importés par un organisateur. |
| | `event_cards` | Carte configurée pour un événement, par catégorie ou par défaut (`category_id` null). |
| | `invitations` | Carte générée pour un invité (1–1), avec le jeton unique du lien invité et du QR code. |
| Invités | `guests` | Invité : nom affiché, téléphone, catégorie, nombre de places, réponse et état des relances. |
| Relances | `messages` | Messages WhatsApp (invitation, relance) et leur état d'envoi. |
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

Statut : **à faire**, non prioritaire pour la première version.

### Principe

Le créateur de l'événement génère depuis son tableau de bord un **lien de scan** qu'il partage à ses agents d'accueil. Ce lien s'ouvre sur **n'importe quel smartphone**, dans le navigateur, sans application à installer ni compte à créer. Il permet de scanner le QR code de chaque invité pour savoir s'il est invité ou non, puis de le faire entrer.

### Comportement attendu

- Scan du QR code de la carte d'invitation avec la caméra du téléphone.
- Résultat immédiat : invité attendu (nom, catégorie VIP / Normal…), déjà entré, ou inconnu.
- Bouton « Faire entrer » qui enregistre l'entrée (heure, agent).
- Un même QR code ne peut servir qu'une fois.

### Sécurité (raison d'être du lien dédié)

- Lien propre à un événement, avec un jeton long et impossible à deviner.
- Le lien donne uniquement le droit de scanner : aucun accès au tableau de bord, à la liste complète des invités ni aux numéros de téléphone.
- Le créateur peut désactiver ou régénérer le lien à tout moment. Le lien est valable seulement autour de la date de l'événement.

### Points à préciser plus tard

- Un lien par agent ou un lien partagé ? Code PIN en plus du lien ?
- Plusieurs agents en même temps : synchronisation en temps réel pour éviter les doubles entrées.
- Fonctionnement hors connexion (maquette prévue : `uiux/visual-identity/mockups/mobile-scan-hors-connexion.html`).

Maquettes de référence : `mobile-scan.html`, `mobile-scan-deja-entre.html`, `mobile-scan-inconnu.html`, `mobile-scan-hors-connexion.html` dans `uiux/visual-identity/mockups/`.
