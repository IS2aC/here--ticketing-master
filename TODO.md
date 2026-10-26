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
- [ ] **Page invité** : date limite de réponse choisie par l'organisateur (aujourd'hui : jusqu'au début de l'événement) ; savoir si l'invité a ouvert son invitation ; limiter les appels répétés aux adresses publiques `/i/<jeton>`.
- [ ] **Étape 4 « Les relances » : envoi WhatsApp** (EN ATTENTE : choix en cours entre un prestataire tiers et Diffuz, ta propre solution de diffusion). Envoi des cartes, relances automatiques des invités sans réponse, file d'appels du support. Prévoir un connecteur d'envoi interchangeable (`WHATSAPP_PROVIDER`) pour changer de prestataire sans toucher au reste ; table `messages` déjà prête (statuts programmé / envoyé / reçu / lu / échoué).

## Ajustements (à traiter une fois le parcours complet terminé)

- [ ] **Choix de la carte** : ajouter une palette de couleurs, et quelques modifications réalisées à la demande du client.
- [ ] **Retour vers l'événement** depuis les étapes (carte, import, modification) : un bouton retour simple, ou un lien plus visible (par exemple en rouge) vers l'événement.
- [ ] **Encadré « L'événement » de la vue événement** : rubriques **Type, Date, Heure de début, Durée, Lieu, Invités prévus, Dress code**.
  - Aucune valeur ne doit passer à la ligne.
  - L'encadré garde ses dimensions actuelles : il ne doit pas s'allonger.
  - Les données doivent y tenir de façon lisible. Une disposition des rubriques de gauche à droite convient.
- [ ] **Supprimer un événement**, depuis l'encadré de l'événement : supprime aussi tout ce qui lui appartient (catégories, invités, imports, cartes, invitations, liens de scan, entrées, messages et appels).
  - Action irréversible : boîte de dialogue de confirmation, selon DESIGN.md (« Supprimer l'événement Mariage Aya & Koffi ? », conséquence en une phrase, « Garder l'événement » à gauche, bouton rouge « Supprimer l'événement » à droite).
  - Point technique : `invitations.event_card_id` est en `ON DELETE RESTRICT`. Il faut vérifier que la suppression en cascade passe, ou supprimer explicitement dans le bon ordre.
- [ ] **Règles d'entrée au scan** (à réfléchir). Pour l'instant, le scan valide seulement que **la carte est valide** et que **l'invité appartient à l'événement**. À décider ensuite :
  - invité qui a **décliné** : bloquer, ou laisser l'agent décider (aujourd'hui : entrée avec un avertissement) ;
  - invité **sans réponse** : entrée autorisée ou non ;
  - **ouverture du scan** : dès la création du lien, ou seulement le jour J (par exemple 6 h avant le début) ;
  - **événement annulé** : bloquer le scan ;
  - **plusieurs personnes** sur une invitation : entrée partielle ou totale au premier scan.
