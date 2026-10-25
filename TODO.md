# TODO

On commence simple (parcours de `Parcours.excalidraw`), les fonctionnalités s'ajoutent au fur et à mesure.

## Plus tard

- [ ] **Authentification OTP WhatsApp** à l'inscription et à la connexion. Pour l'instant : téléphone ou email + mot de passe. Prévoir une table `otp_codes` (code haché, expiration, nombre d'essais).
- [ ] **Scan à l'entrée** : le créateur de l'événement envoie un lien de scan, ouvrable sur n'importe quel smartphone, pour vérifier les invités et les faire entrer. Détails : [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md#scan-à-lentrée-contrôle-daccès).
- [ ] **Limiter les tentatives de connexion** (par numéro et par IP) contre la recherche de mots de passe.
- [ ] **Mot de passe oublié** (réinitialisation par WhatsApp ou e-mail).
- [ ] **Plusieurs lieux par événement** (Cérémonie, Réception… comme dans la maquette `backoffice-creation`) : aujourd'hui un seul lieu.
- [ ] **Fuseau horaire par événement** (Cotonou, Lomé…) : aujourd'hui tout est à l'heure d'Abidjan.
- [ ] **Corriger une ligne dans l'aperçu d'import** (lien « Corriger » de la maquette) et **modifier ou ajouter un invité à la main** : aujourd'hui, on corrige le fichier et on réimporte.
- [ ] **Nombre de personnes par invité** (colonne « Nb pers. » de la maquette, accompagnants) : aujourd'hui 1 par défaut.
- [ ] **Personnaliser la carte** : photo, textes, couleurs, carte par catégorie (maquette `backoffice-carte`) ; import d'un modèle de carte. Aujourd'hui : une carte automatique par type d'événement.
- [ ] **Page invité** : date limite de réponse choisie par l'organisateur (aujourd'hui : jusqu'au début de l'événement) ; savoir si l'invité a ouvert son invitation ; limiter les appels répétés aux adresses publiques `/i/<jeton>`.

## Ajustements (à traiter une fois le parcours complet terminé)

- [ ] **Choix de la carte** : ajouter une palette de couleurs, et quelques modifications réalisées à la demande du client.
- [ ] **Retour vers l'événement** depuis les étapes (carte, import, modification) : un bouton retour simple, ou un lien plus visible (par exemple en rouge) vers l'événement.
- [ ] **Encadré « L'événement » de la vue événement** : rubriques **Type, Date, Heure de début, Durée, Lieu, Invités prévus, Dress code**.
  - Aucune valeur ne doit passer à la ligne.
  - L'encadré garde ses dimensions actuelles : il ne doit pas s'allonger.
  - Les données doivent y tenir de façon lisible. Une disposition des rubriques de gauche à droite convient.
