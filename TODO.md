# TODO

On commence simple (parcours de `Parcours.excalidraw`), les fonctionnalités s'ajoutent au fur et à mesure.

## Plus tard

- [ ] **Authentification OTP WhatsApp** à l'inscription et à la connexion. Pour l'instant : téléphone ou email + mot de passe. Prévoir une table `otp_codes` (code haché, expiration, nombre d'essais).
- [ ] **Scan à l'entrée, compléments** : mode hors connexion (liste sur l'appareil, synchronisation au retour du réseau, maquette `mobile-scan-hors-connexion`) ; code PIN en plus du lien ; « Appeler le responsable » (numéro de l'organisateur) ; entrée partielle quand une invitation compte plusieurs personnes.
- [ ] **Limiter les tentatives de connexion** (par numéro et par IP) contre la recherche de mots de passe.
- [ ] **Mot de passe oublié** (réinitialisation par WhatsApp ou e-mail).
- [ ] **Plusieurs lieux par événement** (Cérémonie, Réception… comme dans la maquette `backoffice-creation`) : aujourd'hui un seul lieu.
- [ ] **Fuseau horaire par événement** (Cotonou, Lomé…) : aujourd'hui tout est à l'heure d'Abidjan.
- [ ] **Corriger une ligne dans l'aperçu d'import** (lien « Corriger » de la maquette) et **modifier ou ajouter un invité à la main** : aujourd'hui, on corrige le fichier et on réimporte.
- [ ] **Nombre de personnes par invité** (colonne « Nb pers. » de la maquette, accompagnants) : aujourd'hui 1 par défaut.
- [ ] **Personnaliser la carte** : photo, textes, couleurs, carte par catégorie (maquette `backoffice-carte`) ; import d'un modèle de carte. Aujourd'hui : une carte automatique par type d'événement.
- [ ] **Cartes proposées et modifiées par IA** (à commencer simple, avec **1min.ai**) :
  - **génération** : à partir du type d'événement, des informations et des photos des hôtes (mariés, famille, organisateur), l'IA propose 2 ou 3 cartes ;
  - **modification** : retouches demandées en langage courant (« plus sobre », « texte plus court », « couleurs plus chaudes ») et ajustements directs (textes, palette, cadrage de la photo) avec aperçu immédiat ;
  - principe à garder : l'IA propose les réglages de la carte (modèle, palette, formule, textes, cadrage, éventuellement un fond décoratif), et le rendu actuel (Satori, `lib/card/render.tsx`) dessine la carte. Les noms, les dates, le QR code et le sceau Here! ne sont jamais dessinés par l'IA ;
  - un fond décoratif généré l'est une fois par événement et réutilisé pour tous les invités ;
  - garde-fous : pas de visages générés ni modifiés, portrait du défunt seulement recadré et en noir et blanc pour un hommage, photos utilisées uniquement pour la carte et supprimées avec l'événement ;
  - à vérifier avec 1min.ai : accès par API, modèles d'image et de texte disponibles, prix, conditions d'utilisation des photos envoyées ;
  - plus tard : nombre de propositions limité par événement, ou option payante.
- [ ] **Page invité** : date limite de réponse choisie par l'organisateur (aujourd'hui : jusqu'au début de l'événement) ; savoir si l'invité a ouvert son invitation ; limiter les appels répétés aux adresses publiques `/i/<jeton>`.
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
  - écran de la conseillère : file d'appels (table `calls`), résultat de l'appel, messages des invités à traiter (`inbound_messages.handled_at`) ;
  - lien d'un message libre (« On sera 3 ») vers la fiche de l'invité ;
  - surveiller la session WasenderAPI (webhook `session.status`) et prévenir si le numéro est déconnecté ;
  - rappel la veille avec le QR code d'entrée.

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
- [ ] **Portail admin** (équipe Here!, rôle `admin`) — côté serveur fait le 29/10 (API `/v1/admin`, commande `python -m app.admin`), tableau de bord fait le 29/10 (`/admin`, maquette de l'équipe) ; restent les écrans Comptes, Événements et Réglages :
  - suivre les **utilisateurs** (comptes, date d'inscription, nombre d'événements, activité) ;
  - suivre les **événements** (statut, invités, cartes, invitations envoyées, réponses, entrées) ;
  - choisir le **prestataire d'envoi WhatsApp** sans redéployer : WasenderAPI, Diffuz ou l'API officielle Meta. Aujourd'hui, c'est la variable `WHATSAPP_PROVIDER` ; le connecteur est déjà interchangeable ;
  - y regrouper les réglages prévus pour le portail : options payantes par compte (relances à la demande), calendrier des relances, cadence d'envoi.
- [ ] **Règles d'entrée au scan** (à réfléchir). Pour l'instant, le scan valide seulement que **la carte est valide** et que **l'invité appartient à l'événement**. À décider ensuite :
  - invité qui a **décliné** : bloquer, ou laisser l'agent décider (aujourd'hui : entrée avec un avertissement) ;
  - invité **sans réponse** : entrée autorisée ou non ;
  - **ouverture du scan** : dès la création du lien, ou seulement le jour J (par exemple 6 h avant le début) ;
  - **événement annulé** : bloquer le scan ;
  - **plusieurs personnes** sur une invitation : entrée partielle ou totale au premier scan.
- [x] **Retours de navigation identiques** (fait le 29/10) : un seul style, celui de « Retour à l'événement » (lien rouge avec flèche, au-dessus du titre). « Retour au tableau de bord » sur la page de l'événement, la création d'un événement, la bibliothèque de cartes et le profil ; « Retour à l'événement » sur les étapes d'un événement. À garder pour tout nouvel écran (`components/back-link.tsx`).
- [ ] **Ajustement complet du branding de la solution**.
