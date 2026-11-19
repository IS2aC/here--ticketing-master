# Skills de génération des cartes

Un fichier par type d'événement (le nom du fichier est la valeur du type : `mariage.md`, `concert_prive.md`…).
Seul le fichier du type de l'événement est envoyé, jamais les douze.

Chaque fichier a deux parties, sous ces titres exacts :

- `## Illustration` : pour le modèle d'image. **Court** (une centaine de mots au plus) : un modèle d'image
  suit mal les longues consignes. Ambiance, motifs, lumière, à éviter.
- `## Propositions` : pour le modèle de texte qui rend les trois chartes en JSON. Plus détaillé : compositions,
  polices, palettes, ton et exemples de formules, à éviter.

Ces règles **guident** l'IA. Les garanties restent dans le moteur et ne doivent pas être répétées ici :
textes exacts de l'événement, noms vérifiés (`isGrounded`), contraste WCAG, sceau QR en bas à droite,
portrait d'hommage jamais confié à l'IA, image sans texte.

Pour écrire les exemples de formules :

- pas de nom propre ni de chiffre : ils seraient refusés par `isGrounded` s'ils ne sont pas dans l'événement ;
- pas de majuscule en milieu de phrase (« que Dieu… » serait refusé pour la même raison) ;
- respecter les longueurs : surtitre 40, titre 48, ligne d'accroche 70, phrase de fin 90, mention avant le
  nom de l'invité 36 caractères.

Compositions disponibles : `mariage-feuillage-dore`, `dot-motifs-wax`, `anniversaire-confettis`,
`bapteme-douceur`, `seminaire-ondes`, `festival-nuit-couleurs`.
