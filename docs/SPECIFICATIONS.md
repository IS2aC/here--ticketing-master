# Here! · Spécifications techniques

Document vivant : les fonctionnalités sont ajoutées au fur et à mesure (voir [TODO.md](../TODO.md)).

## Base de données

PostgreSQL 15 ou plus. Schéma visuel : [base-de-donnees.excalidraw](base-de-donnees.excalidraw). Script de création : [schema.sql](schema.sql).

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
