# Catalogue des modèles de cartes

Les modèles proposés aux organisateurs (page **Cartes** du tableau de bord). L'API les enregistre en base à chaque
démarrage (`app/catalog.py`) : modifier un fichier puis redéployer suffit, seuls les changements sont réécrits.

## Contenu d'un modèle

Un dossier par modèle, nommé par son code (`dot-wax`, `festival-couleurs`…) :

| Fichier | Rôle |
|---|---|
| `definition.json` | Formats, palettes, polices, champs, correspondance avec l'événement, calques. Schéma : `app/card_templates.py`. |
| `*.svg` | Fond et ornements. Clé = nom du fichier (`fond.svg` → `"asset": "fond"`). |
| `exemple.jpg` | Photo des aperçus de la galerie (clé `exemple-photo`). Sur sa carte, l'organisateur met la sienne. |

`catalogue.json` liste les modèles dans l'ordre de la galerie, avec leur nom, leur style
(`luxe_gold`, `boho`, `minimal`, `wax_afro`, `floral`) et les types d'événements concernés.

## Ajouter un modèle

1. Créer le dossier et son `definition.json` (partir d'un modèle existant).
2. Ajouter la ligne dans `catalogue.json`.
3. Vérifier : `uv run pytest tests/test_card_catalog.py tests/test_card_definition.py` (API), puis
   `npm test` dans `web/frontend` : chaque modèle doit se dessiner sans alerte de débordement ni de contraste.
4. Donner un `example` à chaque champ : la galerie montre une carte complète.

Règles vérifiées à l'enregistrement : format WhatsApp 4:5 présent, un seul calque QR code, un texte avec
`{invite.nom}`, champs cités existants, textes et QR code à 5 mm de la coupe si l'A5 est proposé.

## Images

- **Fonds** : SVG ou PNG 1080 × 1350 (4:5), **sans texte**. Les SVG utilisent `currentColor` pour suivre la palette
  (`"tint": "accent"` dans le calque) ; `preserveAspectRatio="xMidYMid slice"` pour s'adapter aux autres formats.
- **Ornements** : SVG ou PNG transparent, sans texte, cadrés au plus près du motif.
- **Photo d'exemple** : JPEG, 1100 px au plus sur le grand côté, moins de 300 Ko, sans logo ni texte de marque
  (les photos d'origine sont dans `uiux/assets/models-cards/`).

Les fonds et ornements actuels sont **provisoires** : à remplacer par les visuels définitifs, mêmes noms de fichiers.
