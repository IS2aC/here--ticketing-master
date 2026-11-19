# Skills de génération des cartes

Un fichier par type d'événement (le nom du fichier est la valeur du type : `mariage.md`, `concert_prive.md`…).
Seul le fichier du type de l'événement est envoyé, et chaque appel ne reçoit que sa partie
(`src/lib/card/skills.ts`).

Chaque fichier a deux parties, sous ces titres exacts :

- `## Illustration` : remplace la direction artistique du type dans le prompt du modèle d'image
  (`imagePrompt.ts`). **Courte** (une centaine de mots au plus) : un modèle d'image suit mal les longues
  consignes. Sujet, matières, couleurs, à éviter. **Ni mise en page ni moment de la journée** : le code ajoute
  les zones réservées (centre, photos, portrait) et la lumière d'après l'heure de l'événement. Ne pas écrire
  les mots « texte », « QR » ou « affiche » : le modèle aurait tendance à dessiner des lettres.
- `## Propositions` : ajoutée au prompt du modèle qui rend les trois chartes en JSON (`proposals.ts`). Une
  ligne par direction (classique, moderne, audacieuse), le ton, des exemples de formules, à éviter.

Ces règles **guident** l'IA. Les garanties restent dans le moteur et ne sont pas répétées ici : textes exacts
de l'événement, titre tiré du titre saisi, noms vérifiés (`isGrounded`), contraste WCAG, sceau QR en bas à
droite, portrait d'hommage jamais confié à l'IA. Le thème, le code couleur, le moment et la demande de
l'organisateur passent avant les suggestions des fiches.

Exemples de formules, sur des lignes qui commencent par `- Surtitres :`, `- Fins :` ou `- Mentions avant le
nom :` (vérifiées par `skills.test.ts`) :

- pas de nom propre ni de chiffre, pas de majuscule en milieu de phrase (« que Dieu… » serait refusé) ;
- pas d'anglais, pas de fait supposé (places limitées, contrôle à l'entrée, contexte religieux) ;
- longueurs : surtitre 40, phrase de fin 90, mention avant le nom de l'invité 36 caractères.

Textes affichés par composition (le prompt système le dit aussi au modèle) :

| Composition | Surtitre | Titre | Accroche | Fin | Mention invité |
|---|:-:|:-:|:-:|:-:|:-:|
| `mariage-feuillage-dore` | ✓ | ✓ | | ✓ | ✓ |
| `dot-motifs-wax` | ✓ | ✓ | | ✓ (remplacée par la tenue s'il y en a une) | ✓ |
| `anniversaire-confettis` | ✓ | ✓ | | | ✓ |
| `bapteme-douceur` | ✓ | ✓ | | ✓ | ✓ |
| `seminaire-ondes` | ✓ | ✓ | | ✓ | ✓ |
| `festival-nuit-couleurs` | ✓ | ✓ | ✓ | ✓ | ✓ |
