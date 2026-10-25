# DESIGN.md — Here!

> Direction artistique destinée aux agents et aux développeurs front.
> Lis ce fichier en entier avant d'écrire la moindre ligne d'interface pour Here!.
> Les valeurs exactes vivent dans `tokens/` : n'écris jamais une couleur, une taille ou un espacement en dur.

**Here! · Ticketing Master** est le maître de cérémonie des événements d'Afrique de l'Ouest francophone, du brunch au festival. L'organisateur :
1. crée son événement (mariage, dot, baptême, funérailles, anniversaire, brunch, retrouvailles, réunion, séminaire, concert privé, festival) ;
2. importe sa liste d'invités (Excel ou CSV) ;
3. génère une carte d'invitation personnalisée avec QR code pour chaque invité, envoyée par WhatsApp.

Here! relance automatiquement par WhatsApp, puis l'équipe support appelle les invités qui n'ont pas répondu. Le jour J, chaque invité est accueilli au QR code. L'invité n'installe aucune application.

Promesse : **vous invitez, Here! s'occupe du reste.** Accroche : *Organisez votre cérémonie. Les relances, on s'en charge.*
Feuille de route : signature électronique de l'hôte sur la carte (bientôt), billetterie payante pour les grands événements (plus tard ; écrans archivés dans `mockups/archive-billetterie/`).

## L'essentiel en 6 règles

1. **Deux étages.** L'interface Here! (tableau de bord, messages, page invité, scan) porte l'identité Here!. La **carte d'invitation appartient à l'hôte** : elle suit un modèle, et Here! n'y apparaît que dans le **sceau** en pied de carte.
2. **Le tableau de bord est sobre.** Fond clair, noir pour structurer, **un seul bouton rouge par écran** (l'action principale : « Créer l'événement », « Envoyer les invitations », « Programmer la relance »).
3. **Un statut, c'est une icône, un mot et une couleur.** Confirmé, En attente, Relancé, Appel prévu, Décliné, Injoignable. Jamais la couleur seule.
4. **L'invité a peut-être 70 ans.** Page invité en 17 px minimum, boutons de 56 px, phrases courtes, aucune application à installer, aucune action cachée.
5. **La discrétion se voit.** Numéros masqués dans les listes (`07 •• •• 34 56`), mention « Liste privée » près des données, rappel que la réponse n'est vue que par l'hôte.
6. **Le slash à 18° est réservé à la marque** (communication, modèle Soirée, contrôle d'accès). Jamais sur les cartes Cérémonie, Officiel, Hommage, ni dans les formulaires.

## Brancher l'identité dans un projet

```html
<link rel="stylesheet" href="visual-identity/typography/fonts.css">
<link rel="stylesheet" href="visual-identity/tokens/tokens.css">
<!-- Cartes d'invitation et visuels de campagne uniquement : -->
<link rel="stylesheet" href="visual-identity/typography/fonts-italic.css">
```

```js
// tailwind.config.js
module.exports = {
  presets: [require('./visual-identity/tokens/tailwind.preset.js')],
};
```

- Logos : `logo/svg/` (à inliner ou en `<img>`), `logo/png/` pour les contextes sans SVG.
- Favicons : copier `logo/favicon/` à la racine publique et référencer `site.webmanifest`.
- Pictogrammes : `elements/icons/*.svg`, 52 icônes (trait `currentColor`, à inliner pour hériter de la couleur).
- Écrans de référence : `mockups/*.html` ; feuilles partagées `_backoffice.css` (tableau de bord), `_mobile.css` (mobile), `_carte.css` (cartes et sceau).
- Utilise les tokens **sémantiques** (`--color-primary`, `--color-text`, `--color-status-confirmed`…) plutôt que les primitifs (`--color-red`) : c'est ce qui permet le mode sombre.
- **Thème** : fixe toujours `data-theme` sur `<html>`.
  - Tableau de bord, formulaires, page invité (confirmation) : `light`.
  - QR code de l'invité, scan à l'entrée, modèle Soirée : `dark`.

## Personnalité → traduction visuelle

| Trait | Se traduit par | Ne se traduit pas par |
|---|---|---|
| Énergique, festive | Cartes soignées, photos de moments partagés, rouge Here sur l'action, slash en communication | Confettis, emojis dans l'interface, compte à rebours clignotant |
| Fiable | Statuts explicites, chiffres en Inter tabulaires, QR code toujours sur blanc, sceau Here! identique sur chaque carte | Animations pendant un envoi, chiffres arrondis ou « environ » |
| Accessible | 17 px côté invité, boutons de 56 px, vouvoiement, deux choix clairs (« Oui, nous serons présents » / « Non… ») | Jargon (« RSVP », « parsing », « conversion »), petits liens gris |
| Moderne, premium | Beaucoup de blanc, une seule couleur d'action, rayons généreux, Playfair Display dans les cartes de cérémonie | Bleu générique de formulaire, ombres lourdes, dégradés arc-en-ciel |
| Proche, humaine | La conseillère a un prénom et un visage, ses appels apparaissent dans le suivi | Robot anonyme, « l'équipe » sans nom |

## Couleurs

Proportions de la marque : **50 % blanc, 25 % noir graphite, 15 % gris clair, 10 % rouge**.

| Token sémantique | Clair | Sombre | Quand l'utiliser |
|---|---|---|---|
| `--color-background` | Blanc | Noir graphite | Fond de page |
| `--color-surface` | Gris clair `#F4F4F4` | Noir carte `#171717` | Panneaux secondaires, champs de recherche, puces, fond du tableau de bord |
| `--color-border` | `#E2E2E2` | `#2A2A2A` | Séparateurs, contour des champs et des types d'événement |
| `--color-text` | Noir graphite | Blanc | Texte principal |
| `--color-text-muted` | `#6B6B6B` | `#8A8A8A` | Métadonnées (date, lieu), aides, libellés d'axes |
| `--color-primary` | Rouge Here | Rouge Here | Bouton principal, étape en cours, onglet actif, série d'un graphique |
| `--color-primary-hover` | `#B30500` | `#B30500` | Survol et état pressé du bouton principal |
| `--color-on-primary` | Blanc | Blanc | Texte sur rouge |
| `--color-accent-text` | Rouge Here | Rouge vif `#FF4D3D` | Texte ou icône rouge (« Ajouter un lieu », « Itinéraire », onglet actif) |
| `--color-inverse` / `--color-on-inverse` | Noir / blanc | Blanc / noir | Bouton secondaire plein, encart « Prochaine relance », encart conseillère |
| `--color-status-confirmed` | `#1A7F37` | `#3FB950` | Confirmé, invité attendu, fichier lu |
| `--color-status-pending` | `#965A00` | `#F2A93B` | En attente, numéro à vérifier, rappel prévu |
| `--color-status-declined` | `#6B6B6B` | `#8A8A8A` | Décliné, non envoyé |
| `--color-status-unreachable` | `#B30500` | `#FF4D3D` | Injoignable |
| `--color-success` / `--color-warning` / `--color-error` | idem | idem | États génériques (sécurité, alertes de formulaire, erreurs) |

Couleurs de **modèles de cartes uniquement** (jamais dans l'interface Here!) : `--color-ivory` `#F7F1E8`, `--color-gold` `#A8823C`, `--color-stone-50` `#F3F1EC`, `--color-stone-600` `#5E5A53`.

Règles :
- **Un seul bouton rouge par écran.** Les actions secondaires utilisent `.btn.ghost` (contour) ou `.btn.inverse` (plein noir).
- **Texte rouge sur fond noir : `--color-accent-text`** (le Rouge Here sur noir fait 3,96:1, réservé aux titres de 24 px et plus).
- **L'or sur ivoire fait 3,16:1** : ornements et titres de 24 px et plus seulement. Le texte des cartes Cérémonie reste en noir graphite.
- **Les couleurs de statut ne décorent jamais.** Une barre de répartition des confirmations est le seul graphique qui en utilise plusieurs, toujours avec sa légende (icône + mot + nombre).
- **Couleur de l'hôte** (modèle Officiel : couleur d'entreprise) : acceptée uniquement si elle fait au moins 4,5:1 sur blanc. Sinon, elle ne sert qu'aux aplats décoratifs (bandeau, pastille du logo).
- **Logos des moyens de paiement et de WhatsApp** : seule exception à la palette. Couleurs officielles, uniquement dans une pastille de 40 px maximum à côté du nom du service, jamais ailleurs.
- Tous les couples texte/fond de `colors/palette.json` passent WCAG AA ; n'en invente pas d'autres sans recalculer le contraste.

## Typographie

| Famille | Rôle | Où |
|---|---|---|
| **Poppins** (800, 700, 600, 500, 400) | Marque et interface | Partout |
| **Poppins ExtraBold Italic** | Accroches de campagne | Affiches, réseaux sociaux, modèle Soirée |
| **Playfair Display** (600, 400, italique 400) | Accent des cartes | Modèles Cérémonie et Hommage, bandeau hôte de la page invité |
| **Inter** (600, 500, 400) | Chiffres | KPI, tableaux et graphiques du tableau de bord |
| **DM Mono** (500, 400) | Codes | N° d'invitation (`INV-AK26-0142`), variables de messages |

| Niveau | Classe CSS | Usage |
|---|---|---|
| display | `.text-display` | Accroche de marque, affiche (« Vous invitez. On s'occupe du reste. ») |
| h1 | `.text-h1` | Titre de page web |
| h2 | `.text-h2` | Titre de section |
| h3 | `.text-h3` | Titre de panneau, de carte |
| body | `.text-body` | Texte courant |
| small | `.text-small` | Interface du tableau de bord, lignes de liste |
| caption | `.text-caption` | Surtitres en capitales espacées, libellés de champs |
| data | `.text-data` | Chiffres et tableaux (Inter, `font-variant-numeric: tabular-nums`) |
| code | `.text-code` | Codes d'invitation (DM Mono) |
| guest | `.text-guest` | **Texte courant de la page invité (17 px minimum)** |
| invite | `.text-invite` | Noms des hôtes sur les cartes Cérémonie et Hommage (Playfair Display) |

Règles :
- **Graisses autorisées** : 800 (display, titres de cartes Rendez-vous et Soirée), 700 (titres), 600 (boutons, libellés forts), 500 (interface), 400 (texte). Pas de Light, pas de Black.
- **Playfair Display n'entre jamais dans l'interface Here!** (tableau de bord, boutons, messages système).
- Prix et chiffres : Inter dans le tableau de bord, jamais de monospace (DM Mono est réservé aux codes).
- Longueur de ligne : 65 caractères au maximum pour le texte courant.
- Espaces insécables avant les unités et les heures (« 10 h », « 15 000 FCFA »).
- Outils qui ne proposent pas nos polices (générateurs d'interface, outils no-code) : Poppins → **Montserrat** ou Outfit ; DM Mono → **JetBrains Mono** ; Playfair Display reste Playfair. Le livrable final repasse toujours aux polices de référence.

## Espacements, rayons, ombres

- Grille de base : **4 px**. Utilise uniquement `--space-*`.
- Tableau de bord : barre latérale 248 px, contenu en panneaux espacés de `--space-4`, marges `--space-8`. Mobile : marges latérales `--space-5`.
- Rayons : boutons et puces `--radius-full` ; champs et types d'événement `--radius-md` (12 px) ; panneaux, sceau `--radius-lg` (20 px) ; feuilles et en-têtes mobiles `--radius-xl` (28 px) ; badges et tags `--radius-sm`.
- Ombres : `--shadow-sm` pour les panneaux, `--shadow-md` pour les aperçus de cartes, `--shadow-lg` pour les éléments flottants. `--shadow-glow` uniquement sur un bouton principal posé sur photo sombre.

## Composants

### Boutons
- **Primaire** : fond `--color-primary`, texte `--color-on-primary`, Poppins 600, `--radius-full`. Hauteur 40 px (tableau de bord), 52 px (mobile), **56 px (page invité)**. Commence toujours par un verbe.
- **Secondaire plein** (`.inverse`) : noir, pour l'action secondaire importante.
- **Secondaire contour** (`.ghost`) : contour 1 px `--color-border`, texte `--color-text`.
- **Lien** : texte `--color-accent-text`, 600, précédé d'un pictogramme `ajouter` si c'est un ajout (« Ajouter un lieu »).
- États : survol `--color-primary-hover` ; focus visible `outline: 2px solid var(--color-primary); outline-offset: 2px` ; désactivé fond `--color-surface`, texte `--color-text-muted`.

### Création d'événement (assistant en 4 étapes)
- **Étapes** (`.steps`) : 1 L'événement · 2 Les invités · 3 La carte · 4 Les relances. Étape faite : pastille noire ; en cours : pastille rouge, libellé 600 ; à venir : contour gris.
- **Types d'événement** : grille de 6 colonnes, tuiles de 78 px, pictogramme 24 px + mot. Sélection : contour 2 px `--color-primary`, pictogramme rouge.
- **Lieux multiples** : une ligne par moment (Cérémonie, Réception…), avec lieu et heure ; « Ajouter un lieu » en lien.
- **Catégories d'invités** : puces ; VIP en puce noire, les autres en gris clair. L'hôte peut en ajouter.
- Panneau latéral « Ce que nous préparons pour vous » : modèle de carte conseillé et calendrier des relances.

### Import de liste
- Fichier reconnu : encart avec contour vert 1,5 px, nom du fichier, nombre de lignes, statut « Fichier lu ».
- Correspondance des colonnes : tuiles « colonne du fichier → champ Here! » avec coche verte.
- Lignes à corriger **en tête de liste**, fond ambre très léger, statut ambre (« Numéro incomplet ») + lien « Corriger ».
- Résumé : total d'invités, doublons retirés, répartition par catégorie, rappel de confidentialité.

### Carte d'invitation (`_carte.css`)
- Format **4:5** (720 × 900, export 1440 × 1800), optimal dans WhatsApp ; version imprimable A6.
- **Étage hôte** : modèle + palette + photo + textes. Le nom de l'invité est toujours écrit sur la carte (« Une invitation pour Monsieur et Madame Konan »). Quoi, quand, où lisibles en 3 secondes.
- **Le sceau Here!** (non modifiable, identique sur tous les modèles) : bandeau blanc de 152 px en pied de carte, `--radius-lg`.
  - À gauche : QR code de 124 px sur blanc.
  - Au centre : « Invitation personnelle », nom de l'invité, nombre de personnes, catégorie ou table.
  - À droite : symbole « ! », « Invitation vérifiée par Here! », code DM Mono.
  - Sur le modèle Hommage : sceau monochrome (`.sceau.mono`).
  - Il accueillera la signature électronique de l'hôte.
- **Catégorie discrète** : elle n'apparaît que dans le sceau, en petit. On n'affiche jamais « Normal » en grand.

| Modèle | Pour | Fond / accent | Titres |
|---|---|---|---|
| Cérémonie | Mariage, dot, baptême | `--color-ivory` / `--color-gold`, double filet or | Playfair Display 600 + italique |
| Rendez-vous | Brunch, anniversaire, retrouvailles | Rouge Here, photo découpée en biais | Poppins ExtraBold capitales |
| Officiel | Réunion, séminaire, gala | Blanc + couleur de l'hôte (bandeau gauche) | Poppins ExtraBold |
| Hommage | Funérailles, hommage, messe de souvenir | `--color-stone-50` / `--color-stone-600`, **aucun rouge, aucun slash**, portrait en noir et blanc | Playfair Display |
| Soirée | Concert privé, festival, soirée | Noir, photo nuit, slash épais et fin | Poppins ExtraBold Italic |

### Statuts et tags
- `.st.ok` Confirmé (`valide`), `.st.wait` En attente (`horloge`), `.st.neutral` Relancé (`message`) et Appel prévu (`telephone`), `.st.no` Décliné (`decline`), `.st.ko` Injoignable (`alerte`). 12 px, 600, icône 15 px.
- Tags de catégorie : 22 px de haut, `--radius-sm`, 11 px 600 capitales. VIP en noir (`.tag.dark`), les autres en gris clair.
- Barre de répartition : segments séparés de 2 px, dans l'ordre Confirmés → En attente → Déclinés → Injoignables → Non envoyés, légende directe en dessous.

### Relances et appels
- **Calendrier** : frise horizontale. Étapes faites : pastille noire + résultat (« 71 réponses ») ; en cours : pastille rouge avec halo ; à venir : contour gris + cible (« 70 invités »).
- **Aperçu du message** : bulle gris clair, variables en DM Mono dans une puce (`Prénom`), boutons de réponse sous la bulle.
- **Appels de la conseillère** : encart noir avec son prénom, son statut (« En ligne ») ; compteurs (appels, joints, confirmés, injoignables) ; liste des appels avec résultat et note ; script d'appel visible par l'hôte.
- Les relances ne partent qu'aux invités sans réponse : c'est écrit sur l'écran.

### Page invité (web mobile, sans application)
- Barre d'adresse visible avec cadenas (`here.ci/i/…`) : c'est un signal anti-arnaque.
- Bandeau hôte aux couleurs du modèle (ivoire et Playfair pour un mariage), puis zone Here! blanche.
- « Bonjour **Monsieur et Madame Konan**, » puis la question en 24 px (« Serez-vous présents ? »), deux boutons de 56 px : « Oui, nous serons présents » (rouge) / « Non, nous ne pourrons pas venir » (contour).
- Sélecteur de personnes plafonné aux places de l'invitation.
- Lieux avec « Itinéraire », « Ajouter à mon agenda ».
- Après confirmation : écran sombre « Vous êtes attendus ! », QR code de 220 px sur carte blanche, nom, personnes, table, code.

### Message WhatsApp
- Envoyé depuis le compte professionnel vérifié « Here! Invitations », **au nom de l'hôte**.
- Contenu : la carte (image 4:5), puis 3 lignes maximum, puis des boutons de réponse : « Je serai présent(e) », « Je ne pourrai pas venir », « Voir mon invitation ».
- Mention de confiance : « Message envoyé par Here! au nom d'Aya & Koffi. Votre réponse n'est vue que par les mariés. »
- Dans les maquettes, la conversation est représentée par une interface générique, sans reproduire l'interface ni le logo de WhatsApp.

### Navigation
- **Tableau de bord** : barre latérale blanche, logo, encart de l'événement en cours, liens de 40 px (Tableau de bord, Invités, Cartes d'invitation, Relances et appels, Contrôle d'accès ; puis Mes événements, Paramètres), encart noir « Mariam, votre conseillère » en bas. Lien actif : fond `--color-surface`, filet rouge de 3 px, icône rouge.
- **Mobile organisateur** : 4 onglets (Accueil, Invités, Relances, Entrée). Onglet actif rouge + pastille.
- **Scan** : 4 onglets (Accueil, Invités, Entrée, Tables).

### Graphiques
- Une seule série par graphique, en `--color-primary`, trait 2 px, aire rouge 14 % → 0 %.
- Repères verticaux pointillés pour les relances (« Envoi », « Relance 1 », « Appels »), libellés au-dessus.
- Répartitions en barres horizontales `--color-ink` avec valeur directe « confirmés / invités ».
- Infobulle au survol : fond `--color-ink`, valeur en 600, date dessous en `--color-gray-500`. Jamais deux axes Y.

## États des écrans

Chaque écran a cinq états. Les maquettes de référence sont `mockups/backoffice-etats.html` (tableau de bord) et `mockups/mobile-scan-*.html`, `mobile-invite-reponse-non.html` (mobile).

| État | Règle | Exemple |
|---|---|---|
| **Vide** | Pastille gris clair de 64 px avec le pictogramme du sujet, titre de 18 px qui dit ce qui manque, une phrase qui dit quoi faire, **un** bouton principal et éventuellement un lien. Jamais d'écran vide sans action. | « Votre liste d'invités est vide » → « Importer la liste » |
| **Chargement** | Squelettes gris clair (`--color-surface`) à la place exacte du contenu, jamais d'écran blanc ni de rond qui tourne seul. Au-delà de 2 s : barre de progression rouge + compteur en Inter. | « Lecture de votre fichier… 201 / 324 lignes » |
| **Erreur** | Pastille `--color-error` à 8 %, titre qui dit ce qui s'est passé sans accuser l'utilisateur, phrase qui dit quoi faire et rassure sur ce qui n'a pas été perdu. Bouton principal = la solution. | « Nous n'arrivons pas à lire ce fichier. Votre liste précédente n'a pas été modifiée. » |
| **En cours** (traitement long) | Barre de progression, compteur, détail par statut, et la phrase « Vous pouvez fermer cette page ». | Envoi des invitations : 212 / 316 |
| **Résultat** | Notification noire en bas à droite (mobile : en bas, au-dessus des onglets), icône de statut, titre en 600, détail en `--color-gray-500`, lien d'action en `--color-red-bright`. Succès : disparaît après 6 s. Problème : reste jusqu'à ce qu'on le traite. | « 312 invitations envoyées » · « 4 messages non remis → Corriger » |

Cas particuliers :
- **Hors connexion** :
  - Tableau de bord : bandeau noir en haut de page avec pictogramme `alerte` en ambre clair, « Connexion perdue. Vos modifications sont gardées… ».
  - Scan : encart contour ambre au-dessus de la caméra, « Mode hors connexion. Le scan continue… ». Le scan fonctionne hors connexion : la liste est sur l'appareil.
- **Action irréversible** (retirer un invité, annuler l'événement, renvoyer à tous) :
  - boîte de dialogue sur voile noir à 45 % ;
  - titre en question (« Retirer Paul Assi de la liste ? ») et conséquence en une phrase ;
  - bouton de sortie en contour à gauche (« Garder l'invité ») ;
  - bouton destructif plein `--color-error` à droite, avec le verbe exact (« Retirer l'invité »). C'est la seule exception à « un seul bouton rouge ».
- **Scan à l'entrée**, quatre résultats. Le cadre de visée et le contour du résultat prennent la couleur de l'état :

  | Résultat | Couleur | Pictogramme | Action principale |
  |---|---|---|---|
  | Invité attendu | `--color-green-light` | `valide` | « Accueillir le suivant » |
  | Déjà entré | `--color-amber-light` | `horloge` | « Appeler le responsable » (secondaire : accueillir le suivant) |
  | Invitation non reconnue | `--color-red-bright` | `decline` | « Chercher par nom » (secondaire : accueillir le suivant) |
  | Hors connexion | idem « Invité attendu » | `valide` | + encart ambre « Mode hors connexion » |

  Le staff n'a jamais à lire un texte long : le résultat tient en 3 mots en capitales de 21 à 24 px.
- **Page invité**, après un « non » : écran clair « Merci pour votre réponse », date limite pour changer d'avis, champ facultatif « Un mot pour les mariés », bouton « Finalement, je viendrai ». Jamais de culpabilisation. Pour un Hommage : « La famille vous remercie », sans champ de message festif.
- **Invitation expirée ou annulée** : même structure que l'état vide, sur la page invité : « Les réponses sont closes depuis le 30 novembre. Contactez directement Aya & Koffi. ».

## Adaptation aux écrans (responsive)

Points de rupture (`brand.json → breakpoints`, identiques à Tailwind) : **sm 640 · md 768 · lg 1024 · xl 1280**.

| Largeur | Navigation | Mise en page | Tableaux |
|---|---|---|---|
| **< 768 px** (téléphone) | Barre d'onglets en bas, 4 onglets (voir `mobile-tableau-de-bord.html`) | Une colonne, marges `--space-5`, chiffres clés en carte | Remplacés par des listes : nom + détail sur deux lignes à gauche, statut à droite |
| **768 – 1023 px** (tablette) | Barre latérale en **rail d'icônes de 72 px** : symbole « ! » en haut, icônes de 44 px, encart conseillère réduit à son pictogramme (voir `backoffice-tablette.html`) | Une colonne de panneaux, marges `--space-5`, boutons secondaires réduits à l'icône si la place manque | Colonnes secondaires masquées (« Réponse par ») ; nom, catégorie, statut toujours visibles |
| **≥ 1024 px** (ordinateur) | Barre latérale complète de 248 px | Grilles à 2 colonnes (contenu + panneau de 360 à 420 px), marges `--space-8` | Complets |
| **≥ 1280 px** | Idem | Contenu limité à 1440 px de large, centré | Complets |

Règles :
- **Ce qui ne disparaît jamais** : le bouton principal, le statut d'un invité, le chiffre « confirmés / invités ».
- **Ordre d'empilement** sur une colonne : chiffre clé et répartition → relances → liste des invités → catégories.
- **Assistant de création** sur téléphone : une étape par écran, la frise d'étapes devient « Étape 2 sur 4 » + barre de progression ; les types d'événement passent en grille de 3 colonnes.
- **Cartes d'invitation** : format fixe 4:5, jamais recadré. Dans l'éditeur sur tablette ou téléphone, l'aperçu passe au-dessus des réglages.
- **Cibles tactiles** : 44 px minimum partout, 56 px côté invité.
- Sur téléphone, la carte d'invitation et le QR code occupent toute la largeur utile (marges `--space-5`).

## Logo

- Version par défaut : `logo-principal.svg` ; en-tête : `logo-horizontal.svg` ; sur fond sombre : `logo-negatif.svg` (ou `-horizontal`) ; sur fond rouge : `logo-blanc.svg` ; impression une couleur : `logo-mono-noir.svg` ; icône d'app, avatar du compte WhatsApp : `symbole.svg` ; sceau des cartes et favicon : `favicon.svg`.
- Zone de protection : la hauteur de la pastille du point d'exclamation sur chaque côté.
- Taille minimale : 96 px avec descripteur, 56 px pour `logo-horizontal`, 16 px pour `favicon.svg`.
- **Sur une carte d'invitation, le logo complet n'apparaît jamais** : seulement le symbole dans le sceau. La carte est à l'hôte.
- Interdits : déformer, changer les couleurs, redresser le point d'exclamation, ajouter une ombre ou un contour, faire passer un slash à travers le logo, poser le logo en couleur sur une carte Hommage.

## Iconographie

52 pictogrammes maison dans `elements/icons/` : trait 1,75 px sur grille 24, extrémités arrondies, `stroke="currentColor"`, aucun remplissage.
- Types d'événement : `mariage`, `cadeau` (dot), `favori` (baptême), `hommage`, `anniversaire`, `brunch`, `retrouvailles`, `reunion`, `conference` (séminaire), `concert`, `festival`.
- Produit : `invitation`, `importer`, `message`, `telephone`, `relance`, `qr-code`, `scanner`, `etiquette`, `table`, `signature`, `cadenas`, `support`.
- Statuts : `valide`, `horloge`, `decline`, `alerte`.

Couleurs : `--color-text-muted` par défaut, `--color-accent-text` à l'état actif, `--color-red` en présentation marketing. Si un pictogramme manque, dessine-le sur le même principe ou prends-le dans Lucide avec `stroke-width="1.75"`.

## Images

Les briefs détaillés sont dans `imagery/BRIEFS.md`.
- **Registre jour** (mariages, brunchs, retrouvailles, réunions, équipe) : lumière naturelle chaude ; le rouge Here n'apparaît que dans un détail.
- **Registre nuit** (soirées, concerts privés, communication) : clair-obscur, rouge de scène.
- **Hommage** : aucun visage en communication (fleurs, bougie) ; le portrait du défunt n'apparaît que sur la carte, en noir et blanc, fourni par la famille.
- Toujours des personnes africaines et des émotions réelles ; jamais d'écran lisible dans la photo.
- Emplacements provisoires : `.photo.jour`, `.photo.nuit`, `.photo.sobre` avec `data-src` et `data-brief` ; `mockups/_icons.js` charge l'image quand elle existe.

## Mouvement

- 150 ms `cubic-bezier(.2,.8,.2,1)` : survols, pressions, puces, onglets.
- 250 ms : panneaux, étapes de l'assistant, apparition des cartes.
- 400 ms : validation au scan et confirmation de l'invité (le « ! » peut faire un saut de 4 px). Aucune animation festive sur un événement Hommage.
- Envoi des invitations : barre de progression simple et compteur (« 212 / 316 envoyées »), pas d'animation décorative.
- Respecter `prefers-reduced-motion: reduce`.

## Ton de voix

Direct, chaleureux, rythmé. Vouvoiement léger, **jamais de tutoiement**, aucun jargon. Trois voix :

| Voix | Pour | Exemple |
|---|---|---|
| Maître de cérémonie (Here!) | Interface, communication | « Votre liste est importée. 4 numéros sont à vérifier. » |
| Hôte | Cartes, messages aux invités | « Aya & Koffi ont la joie de vous inviter à leur mariage. Serez-vous des nôtres ? » |
| Équipe (support) | Appels, aide | « Bonjour, ici Mariam, de l'équipe Here! J'appelle de la part d'Aya et Koffi. » |

- On dit :
  - « 212 invités ont confirmé. Il reste 70 réponses à obtenir : nous les relançons demain. »
  - « Confirmez votre présence en un clic. »
  - « Validez le paiement sur votre téléphone. »
  - « Invité attendu. »
  - « Accueillir le suivant. »
- On ne dit pas :
  - « RSVP », « taux de conversion », « parsing », « transaction », « e-ticket », « prompt de validation », « lead ».
  - « Erreur ligne 17 ».
  - « Stock limité ! ».
- **Hommage** : formules sobres et consacrées (« ont la profonde douleur de vous annoncer le rappel à Dieu de »), aucun point d'exclamation dans le contenu, aucun emoji, aucune formule festive dans les relances (« La famille vous remercie de confirmer votre présence »).
- Boutons : un verbe, 4 mots au maximum (« Continuer : la carte », « Programmer la relance 3 »).

## Avant de livrer un écran, vérifie

- [ ] Aucune valeur en dur : tout passe par les tokens
- [ ] Un seul bouton rouge par écran
- [ ] Chaque statut a son icône, son mot et sa couleur
- [ ] Côté invité : 17 px minimum, boutons de 56 px, aucune app requise
- [ ] Les numéros de téléphone sont masqués dans les listes
- [ ] Contraste AA et focus visible sur tous les éléments interactifs
- [ ] Sur une carte : sceau Here! présent et intact, nom de l'invité visible, QR code sur blanc
- [ ] Modèle Hommage : aucun rouge, aucun slash, sceau monochrome
- [ ] Les états vide, chargement, erreur et résultat sont prévus
- [ ] L'écran fonctionne à 390, 834 et 1440 px de large
- [ ] `data-theme` est fixé explicitement
- [ ] Les textes sont au vouvoiement, sans jargon, avec espaces insécables
