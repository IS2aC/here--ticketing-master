# TODO

On commence simple (parcours de `Parcours.excalidraw`), les fonctionnalités s'ajoutent au fur et à mesure.

## Plus tard

- [ ] **Authentification OTP WhatsApp** à l'inscription et à la connexion. Pour l'instant : téléphone ou email + mot de passe. Prévoir une table `otp_codes` (code haché, expiration, nombre d'essais).
- [ ] **Scan à l'entrée, compléments** : mode hors connexion (liste sur l'appareil, synchronisation au retour du réseau, maquette `mobile-scan-hors-connexion`) ; code PIN en plus du lien ; « Appeler le responsable » (numéro de l'organisateur) ; entrée partielle quand une invitation compte plusieurs personnes.
- [x] **Limiter les tentatives de connexion** (fait le 29/10) : 5 échecs sur un compte ou 20 depuis une adresse IP en 15 minutes : suspension 15 minutes (aussi pour le « mot de passe actuel » du profil). Table `login_attempts`, gardée 24 h. Le frontend transmet l'adresse IP et le navigateur du visiteur à l'API.
- [x] **Mot de passe oublié** (fait le 29/10) : code à 6 chiffres par WhatsApp, valable 15 minutes, 5 essais, 3 codes par heure et par compte, 10 demandes par heure et par adresse IP ; tous les appareils déconnectés ensuite. Table `otp_codes`, réutilisable pour l'OTP à l'inscription. Pas d'envoi par e-mail (aucun service d'e-mail sur la plateforme).
- [ ] **Plusieurs lieux par événement** (Cérémonie, Réception… comme dans la maquette `backoffice-creation`) : aujourd'hui un seul lieu.
- [ ] **Fuseau horaire par événement** (Cotonou, Lomé…) : aujourd'hui tout est à l'heure d'Abidjan.
- [x] **Corriger une ligne dans l'aperçu d'import** et **ajouter, modifier ou retirer un invité à la main** (fait le 29/10) : lien « Corriger » sur chaque ligne de l'aperçu (vérifiée à nouveau, ou retirée) ; « Ajouter un invité » et « Modifier » sur la liste de l'événement, avec « Retirer de la liste » (confirmation). Numéro valide ou vide, doublons refusés ; un invité ajouté après la préparation des cartes reçoit la sienne.
- [x] **Nombre de personnes par invité** (fait le 30/10) : colonne « Nb pers. » à l'import (1 par défaut, 20 au plus, aussi dans le modèle Excel), champ dans le formulaire d'invité et la correction de l'aperçu, affiché dans la liste. L'invité indique sur sa page combien viendront ; **au scan, toutes les personnes confirmées entrent en une fois** (décision du 30/10), l'agent voit « 3 personnes entrent ».
- [ ] **Personnaliser la carte** : photo, textes, couleurs, carte par catégorie (maquette `backoffice-carte`) ; import d'un modèle de carte. Aujourd'hui : une carte automatique par type d'événement.
- [ ] **Cartes proposées et modifiées par IA** (à commencer simple, avec **1min.ai**) :
  - **génération** : à partir du type d'événement, des informations et des photos des hôtes (mariés, famille, organisateur), l'IA propose 2 ou 3 cartes ;
  - **modification** : retouches demandées en langage courant (« plus sobre », « texte plus court », « couleurs plus chaudes ») et ajustements directs (textes, palette, cadrage de la photo) avec aperçu immédiat ;
  - principe à garder : l'IA propose les réglages de la carte (modèle, palette, formule, textes, cadrage, éventuellement un fond décoratif), et le rendu actuel (Satori, `lib/card/render.tsx`) dessine la carte. Les noms, les dates, le QR code et le sceau Here! ne sont jamais dessinés par l'IA ;
  - un fond décoratif généré l'est une fois par événement et réutilisé pour tous les invités ;
  - garde-fous : pas de visages générés ni modifiés, portrait du défunt seulement recadré et en noir et blanc pour un hommage, photos utilisées uniquement pour la carte et supprimées avec l'événement ;
  - à vérifier avec 1min.ai : accès par API, modèles d'image et de texte disponibles, prix, conditions d'utilisation des photos envoyées ;
  - plus tard : nombre de propositions limité par événement, ou option payante.
- [x] **Page invité** (fait le 30/10) : **date limite de réponse** choisie par l'organisateur (formulaire de l'événement ; sinon jusqu'au début), affichée sur la page invité, respectée par les relances et « Relancer maintenant » ; **invitation ouverte** : première visite de la page notée (« Ouverte le … » dans la liste, « N ouvertes » dans Relances), sans compter les aperçus de lien de WhatsApp ou Facebook. Pas de limite d'appels sur `/i/<jeton>` : le jeton (24 octets aléatoires) ne se devine pas.
- [x] **Étape 4 « Les relances » : envoi WhatsApp avec WasenderAPI** (fait le 28/10) : envoi des cartes (image + lien ; sondage « Oui / Non » retiré le 29/10), relances automatiques, appels programmés pour la conseillère, webhooks (statuts, votes, messages des invités), worker avec cadence anti-blocage. Voir docs/SPECIFICATIONS.md.
- [ ] **Indicatifs pays** : aujourd'hui, un numéro local à 10 chiffres commençant par 0 est considéré comme ivoirien (+225), partout (`api/app/phone.py`) ; l'affichage et le masquage ne savent formater que le +225 (`frontend/src/lib/phone.ts`). À faire :
  - **inscription** : choix de l'indicatif (Côte d'Ivoire par défaut, puis Sénégal +221, Mali +223, Burkina Faso +226, Niger +227, Togo +228, Bénin +229, Guinée +224, Cameroun +237, France +33…) ;
  - **événement** : un pays par défaut pour l'import de la liste (un mariage à Dakar : numéros locaux en +221) ; colonne « Indicatif » facultative dans le fichier et le modèle Excel ;
  - **validation par pays** (longueur et format propres à chaque pays, par exemple avec la bibliothèque `phonenumbers`) au lieu de la seule règle ivoirienne ; garder le cas d'Excel qui supprime le 0 initial ;
  - **affichage et masquage** des numéros de tous les pays (« +221 77 •• •• 45 67 ») ;
  - **WhatsApp** : vérifier l'envoi WasenderAPI vers des numéros hors +225, et le rattachement des messages reçus (`cleanedSenderPn`) pour ces numéros ;
  - lier ce choix au **fuseau horaire par événement** (déjà dans la liste).
- [ ] **Relances à la demande, option payante** (« Relancer maintenant ») : déjà codée mais désactivée (`WHATSAPP_ON_DEMAND_REMINDERS=false`, bouton masqué, API en 403). Non incluse dans la phase de test. À faire :
  - **portail admin** : activer ou désactiver l'option par compte (ou par événement), au lieu de la variable globale ;
  - facturation de l'option (tarif, paiement, suivi des relances consommées).
- [ ] **Fréquence des relances par événement** : aujourd'hui, le calendrier est global (`WHATSAPP_REMINDER_DAYS_BEFORE`, standard offert : 7 jours avant). Plus tard : le régler depuis le portail admin, et proposer des relances supplémentaires en option.
- [ ] **WhatsApp, suite** :
  - plusieurs numéros d'envoi (un worker par numéro) pour aller plus vite ;
  - ~~écran de la conseillère~~ (fait le 30/10 : « Messages » du portail admin, rôle `support` ou admin ; file d'appels avec numéro, script et résultat qui met à jour la réponse de l'invité ; messages des invités à traiter) ;
  - lien d'un message libre (« On sera 3 ») vers la fiche de l'invité ;
  - surveiller la session WasenderAPI (webhook `session.status`) et prévenir si le numéro est déconnecté ;
  - ~~rappel la veille avec le QR code d'entrée~~ (fait le 30/10, **option payante** : activée compte par compte dans le portail admin, coupable par événement sur la page Relances ; la carte et le QR code renvoyés la veille à 10 h aux invités confirmés).

## Ajustements (à traiter une fois le parcours complet terminé)

- [ ] **Choix de la carte** : ajouter une palette de couleurs, et quelques modifications réalisées à la demande du client.
- [x] **Retour vers l'événement** (fait le 29/10 : lien rouge « Retour à l'événement » sur la carte, l'import, l'aperçu de l'import, la modification, le contrôle d'accès et les relances) depuis les étapes (carte, import, modification) : un bouton retour simple, ou un lien plus visible (par exemple en rouge) vers l'événement.
- [x] **Encadré « L'événement » de la vue événement** (fait le 29/10 : grille de deux colonnes, valeurs sur une ligne, texte complet au survol) : rubriques **Type, Date, Heure de début, Durée, Lieu, Invités prévus, Dress code**.
  - Aucune valeur ne doit passer à la ligne.
  - L'encadré garde ses dimensions actuelles : il ne doit pas s'allonger.
  - Les données doivent y tenir de façon lisible. Une disposition des rubriques de gauche à droite convient.
- [x] **Supprimer un événement** (fait le 29/10, depuis la liste « Mes événements » du tableau de bord ; les envois en file sont supprimés avec l'événement) : supprime aussi tout ce qui lui appartient (catégories, invités, imports, cartes, invitations, liens de scan, entrées, messages et appels).
  - Action irréversible : boîte de dialogue de confirmation, selon DESIGN.md (« Supprimer l'événement Mariage Aya & Koffi ? », conséquence en une phrase, « Garder l'événement » à gauche, bouton rouge « Supprimer l'événement » à droite).
  - Point technique : `invitations.event_card_id` est en `ON DELETE RESTRICT`. Il faut vérifier que la suppression en cascade passe, ou supprimer explicitement dans le bon ordre.
- [x] **Bouton « Lancer les invitations » en bas de la liste des invités** (fait le 29/10) (vue de l'événement) : aujourd'hui, l'envoi WhatsApp se lance seulement depuis la page « Relances ». Le bouton doit apparaître quand des cartes sont prêtes, et mettre en file l'envoi des invitations (même action que « Envoyer N invitations » de la page Relances).
- [x] **Dates de relance choisies par l'organisateur** (fait le 29/10 : page Relances, jusqu'à 5 dates gratuites pendant la phase de test, retour au calendrier proposé ; le worker relance à ces dates, dès 8 h, seulement les invités sans réponse) : sur chaque événement, ajouter, modifier et retirer des dates de relance.
  - Si l'événement a lieu dans moins de 7 jours, la relance offerte (J-7) n'est plus possible : la page le dit et propose de choisir une autre date.
  - Reste à décider : faire payer les dates au-delà de la relance offerte (voir « Relances à la demande, option payante » et le portail admin).
- [x] **Vue « Mon profil »** (fait le 29/10 : coordonnées, structure, ville et pays, facturation, changement de mot de passe) (organisateur) : consulter et modifier ses informations (prénom, nom, téléphone, e-mail, mot de passe), et renseigner les informations du client utiles à la facturation et au support (par exemple : nom de l'entreprise ou de la famille, ville, adresse, informations de facturation, à préciser). Accès depuis le bloc du compte en bas de la barre latérale.
- [ ] **Portail admin** (équipe Here!, rôle `admin`) — côté serveur fait le 29/10 (API `/v1/admin`, commande `python -m app.admin`), tableau de bord fait le 29/10 (`/admin`, maquette de l'équipe) ; écrans Utilisateurs (liste, fiche, option « relances à la demande »), Événements et Réglages faits le 29/10 ; écran Messages (appels et messages des invités) fait le 30/10 ; reste Cartes (« Bientôt ») :
  - suivre les **utilisateurs** (comptes, date d'inscription, nombre d'événements, activité) ;
  - suivre les **événements** (statut, invités, cartes, invitations envoyées, réponses, entrées) ;
  - choisir le **prestataire d'envoi WhatsApp** sans redéployer : WasenderAPI, Diffuz ou l'API officielle Meta. Aujourd'hui, c'est la variable `WHATSAPP_PROVIDER` ; le connecteur est déjà interchangeable ;
  - y regrouper les réglages prévus pour le portail : options payantes par compte (relances à la demande), calendrier des relances, cadence d'envoi.
- [x] **Règles d'entrée au scan** (décidées et faites le 29/10) : seuls les invités qui ont **confirmé** entrent. Un invité qui a répondu **non** est refusé (écran rouge « Entrée refusée ») ; un invité **sans réponse** est compté absent et refusé de la même façon ; les « attendus » de l'écran de scan ne comptent que les confirmés. Le scan fonctionne **dès la création du lien**. **Événement annulé** : le scan est bloqué. Plusieurs personnes sur une invitation : toutes entrent au même scan (pas d'entrée partielle).
- [x] **« Une question ? »** (fait le 30/10) : discussion de l'organisateur (fenêtre sur la page floutée) avec un assistant branchable (`ASSISTANT_PROVIDER` : none, openai compatible, webhook), qui transmet à l'équipe s'il ne sait pas ; l'équipe répond dans le portail admin (Messages › Questions ?). Reste : brancher l'agent (Hermes / Nemotron) ou 1min.ai (connecteur à écrire avec sa documentation).
- [x] **Gérer les entrées et sorties** (décidé et fait le 30/10) : option de l'événement, **désactivée par défaut**, sur la page de l'événement. Désactivée : le scan dit seulement que l'invité fait partie de l'événement, à chaque scan (pas de « Déjà entré » ; le premier scan reste compté dans « arrivés / attendus »). Activée : chaque entrée est enregistrée, « Déjà entré » au 2e scan. Les règles d'entrée (confirmés seulement) valent dans les deux cas.
- [x] **Retours de navigation identiques** (fait le 29/10) : un seul style, celui de « Retour à l'événement » (lien rouge avec flèche, au-dessus du titre). « Retour au tableau de bord » sur la page de l'événement, la création d'un événement, la bibliothèque de cartes et le profil ; « Retour à l'événement » sur les étapes d'un événement. À garder pour tout nouvel écran (`components/back-link.tsx`).
- [ ] **Ajustement complet du branding de la solution**.
