# TODO

On commence simple (parcours de `Parcours.excalidraw`), les fonctionnalités s'ajoutent au fur et à mesure.

## Plus tard

- [ ] **Authentification OTP WhatsApp** à l'inscription et à la connexion. Pour l'instant : téléphone ou email + mot de passe. Prévoir une table `otp_codes` (code haché, expiration, nombre d'essais).
- [ ] **Scan à l'entrée** : le créateur de l'événement envoie un lien de scan, ouvrable sur n'importe quel smartphone, pour vérifier les invités et les faire entrer. Détails : [docs/SPECIFICATIONS.md](docs/SPECIFICATIONS.md#scan-à-lentrée-contrôle-daccès).
- [ ] **Limiter les tentatives de connexion** (par numéro et par IP) contre la recherche de mots de passe.
- [ ] **Mot de passe oublié** (réinitialisation par WhatsApp ou e-mail).
