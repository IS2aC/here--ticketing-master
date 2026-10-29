# Portail admin : données affichées

Données fournies par l'API (`/v1/admin/...`, réservée au rôle admin) pour chaque écran du portail. Base de travail pour la maquette.

## 1. Vue d'ensemble

| Donnée | Détail |
|---|---|
| Organisateurs | nombre de comptes organisateurs |
| Nouveaux organisateurs | inscrits depuis 7 jours |
| Événements par statut | brouillon, actif, terminé, annulé |
| Événements à venir | date future, hors annulés |
| Invités | total, tous événements confondus |
| Réponses des invités | confirmés, déclinés, en attente |
| Invitations envoyées | parties, livrées ou lues |
| Relances envoyées | parties, livrées ou lues |
| Messages en file | en attente d'envoi par le worker |
| Échecs d'envoi | messages WhatsApp en échec |
| Entrées | QR codes scannés à l'entrée |
| Appels prévus | appels de la conseillère pas encore passés |
| Prestataire WhatsApp | mode test ou WasenderAPI, configuré ou non |

## 2. Comptes (liste)

Recherche par nom, téléphone, e-mail ou structure. Du plus récent au plus ancien, 50 par page, avec le nombre total.

| Donnée | Détail |
|---|---|
| Prénom, nom | |
| Téléphone | masqué dans la liste (`07 •• •• 34 56`) |
| E-mail | facultatif |
| Structure | entreprise, association ou famille |
| Ville, pays | |
| Rôle | organisateur, support ou admin |
| Relances à la demande | option activée ou non |
| Date d'inscription | |
| Dernière connexion | |
| Nombre d'événements | |

## 3. Fiche d'un compte

Toutes les données de la liste, plus :

- adresse de facturation et numéro d'identification fiscale ;
- **ses événements**, avec les mêmes colonnes que l'écran Événements ;
- **une action** : activer ou désactiver les relances à la demande (option payante).

Le rôle admin ne se donne pas depuis le portail : il se donne par une commande sur le serveur (`python -m app.admin <numéro>`).

## 4. Événements (liste)

Filtres par statut et par période (à venir, passés), recherche par titre ou par organisateur. 50 par page, avec le nombre total.

| Donnée | Détail |
|---|---|
| Titre, type | mariage, dot, funérailles… |
| Statut | brouillon, actif, terminé, annulé |
| Date et heure | |
| Organisateur | nom, lien vers sa fiche |
| Invités | total |
| Cartes | invités dont la carte est préparée |
| Invitations envoyées | invités ayant reçu leur invitation |
| Réponses | confirmés, déclinés, en attente |
| Entrées | invités scannés à l'entrée |
| Échecs d'envoi | messages en échec pour cet événement |

## 5. Réglages de la plateforme

Pour chaque réglage : **valeur en vigueur**, **valeur par défaut** (celle de l'environnement), et s'il a été **modifié depuis le portail** (avec un retour possible à la valeur par défaut). Date de la dernière modification.

Les changements s'appliquent sans redéployer : tout de suite pour l'API, au tour suivant pour le worker d'envoi.

| Réglage | Par défaut | Limites |
|---|---|---|
| Prestataire d'envoi | mode test | mode test ou WasenderAPI ; Diffuz et API Meta affichés « bientôt » |
| Calendrier proposé des relances | 7 jours avant | 5 dates au plus, de 1 à 90 jours avant |
| Délai minimum entre deux invités | 20 s | 5 à 600 s |
| Délai maximum entre deux invités | 45 s | 5 à 600 s, au moins le minimum |
| Taille d'un lot | 25 invités | 1 à 500 |
| Pause entre deux lots | 30 min | 0 à 240 min |
| Début des envois | 8 h | 0 à 23 h |
| Fin des envois | 20 h | 1 à 24 h, après le début |

Refus avec message : délai minimum supérieur au maximum, heure de fin avant l'heure de début, WasenderAPI choisi sans clé configurée.

## Pas encore disponible

Ces données existent en base mais ne sont pas encore exposées au portail ; à ajouter si la maquette en a besoin :

- **détail d'un événement** côté admin : derniers messages envoyés, dates de relance, liens de scan ;
- **évolutions dans le temps** (inscriptions, envois par semaine) pour des graphiques ;
- **file d'appels de la conseillère** (prévue dans le TODO, écran à part).
