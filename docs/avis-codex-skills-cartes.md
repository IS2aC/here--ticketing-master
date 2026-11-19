# Avis de Codex sur les skills de cartes (19/11/2026)

Revue en lecture seule de `web/frontend/src/lib/card/skills/`, branche `skills-cartes`. Texte de Codex, non modifié.

---

**Je garderais les douze fiches et les deux sections par fiche. Je corrigerais leurs consignes avant de les brancher.** Les fiches apportent des distinctions qui comptent, notamment entre la dot et le mariage, entre le concert privé et le festival, et entre une annonce de décès et une invitation à une cérémonie d'hommage. Les principaux problèmes sont concrets. Un exemple est refusé par le validateur, certaines phrases de fin disparaissent au rendu, et plusieurs consignes d'illustration se contredisent une fois combinées au prompt existant.

Revue réalisée en lecture seule sur `skills-cartes`. Les exemples ont été mesurés et la logique de `isGrounded` a été exécutée sur des faits témoins. Les observations sur le rendu découlent du code et des modèles JSON. Les appréciations culturelles sont des hypothèses éditoriales à valider auprès d'organisateurs ivoiriens. Aucune génération d'image ni prévisualisation WhatsApp n'a été effectuée.

## 1. Avis général

Un fichier par type donne un point de maintenance clair. Charger uniquement la fiche du type sélectionné évite de mêler des registres qui doivent rester distincts. Les deux sections ont aussi des rôles différents. L'illustration a besoin de quelques indications concrètes sur le sujet, la lumière et la matière. Les propositions ont besoin de savoir quelle composition convient, quels champs seront visibles et quelles formulations sont appropriées. Les deux appels devraient recevoir uniquement la section qui les concerne, conformément à la structure du README.md.

Je remplacerais les `PREPROMPTS` par la section Illustration lorsque la fiche existe, avec les préprompts actuels en secours. Les empiler répéterait presque mot pour mot le mariage, la dot, le brunch et les retrouvailles. Je garderais dans le code les réserves de mise en page qui dépendent de la présence de photos ou d'un portrait. Côté propositions, le prompt système doit rester la référence pour le français, les faits, le schéma et la priorité des couleurs de l'organisateur. Les fiches devraient préciser comment distinguer les trois directions à l'intérieur d'un type. Aujourd'hui, beaucoup donnent surtout une liste de polices et deux compositions, ce qui laisse le modèle deviner la différence entre « moderne » et « audacieuse ».

## 2. Revue par type

**Mariage**
- Bien : la dorure discrète, les matières ivoire et le feuillage ont une traduction visuelle claire. La fiche propose des alternatives au blanc et or, et « Votre présence comptera pour nous » est simple et chaleureux.
- À corriger : « Afro-chic d'Abidjan » reste une étiquette que le modèle doit interpréter. Le lieu, la matière ou le code couleur fournis sont de meilleurs repères. Réserver les prénoms sur deux lignes à `mariage-feuillage-dore` lorsque les faits s'y prêtent. `bapteme-douceur` a une zone de titre d'une ligne de 440 px et introduit des nuages. Pour les noms longs, Playfair Display est une option à tester avant une calligraphie fine. Sur ivoire, réserver l'or pâle au décor.

**Dot**
- Bien : « Les familles vous invitent » et « Votre présence honorera nos familles » rendent la place des familles explicite. Le wax multicolore conservé avec `ornamentTint: null` et le feuillage comme option sobre sont deux choix lisibles.
- À corriger : l'accumulation « wax, kente, kita ou bogolan », calebasses, bronze et ambiance « royale » risque de produire un décor ouest-africain générique malgré la réserve sur les motifs propres à une communauté. Privilégier un seul textile attesté par la demande ou, à défaut, une bordure graphique inspirée du tissu, avec une encre brune ou noire sur crème. Décrire une variante moderne par sa mise en page et sa typographie. Avec une tenue renseignée, `dot-motifs-wax` affiche celle-ci à la place de la fin.

**Baptême**
- Bien : les pastels, les rameaux et la lumière douce forment une direction cohérente. La fiche est la plus explicite sur le contraste, avec du bleu nuit ou de l'anthracite pour les textes.
- À corriger : « Bienvenue au monde » annonce plutôt une naissance. « Notre petit trésor » et « notre enfant » supposent un jeune enfant et que ses parents parlent. Pour un baptême sans autre précision, « Baptême » ou « Un jour de grâce », selon le registre souhaité, sont plus précis. Distinguer baptême et présentation selon les faits. Si la colombe du `PREPROMPTS` est conservée, la rendre conditionnelle au même titre que les autres symboles religieux. Une police régulière pour le nom de l'invité est un meilleur défaut à tester sur mobile qu'une seconde calligraphie.

**Funérailles**
- Bien : la distinction entre sobriété et ambiance effrayante est juste. Interpréter « audacieuse » par une composition plus graphique permet de proposer une variation digne. « Votre présence sera un réconfort pour la famille » convient à une cérémonie.
- À corriger : « Avis de décès » et « Célébration de la vie de » désignent des usages différents. Les réserver aux faits correspondants et employer « En mémoire de » comme option générale. Les nuages de `bapteme-douceur` peuvent évoquer l'enfance même en gris. Tester `seminaire-ondes`, déjà utilisé par le repli, pour la variante graphique. L'or pâle et l'argent doivent rester décoratifs sur un fond clair. Aligner aussi le repli, qui évoque les « prières » même en l'absence de contexte religieux. La mention du portrait devrait rester dans la branche de mise en page qui sait si un portrait existe.

**Anniversaire**
- Bien : le choix entre confettis et composition de soirée donne deux directions immédiatement compréhensibles. L'âge est conditionné aux faits et l'interdiction de chiffres dessinés protège l'illustration contre l'apparition d'un âge arbitraire.
- À corriger : « Une nouvelle année ensemble » peut évoquer le Nouvel An ou un anniversaire de couple. « C'est la fête » fonctionne dans davantage de cas. Prévoir un style adulte hors soirée, sans imposer le trio noir, or et champagne. Sur un fond blanc ou jaune, choisir une encre sombre pour le nom et les petites mentions. Les deux fins proposées sont ignorées dans `anniversaire-confettis`.

**Brunch**
- Bien : la terrasse, les fruits et le lin donnent une ambiance diurne tangible. « Un brunch entre nous » est court et naturel. Raleway ou Josefin Sans peuvent donner une direction légère sans rivaliser avec le titre.
- À corriger : fruits tropicaux et viennoiseries décrivent un brunch chic assez générique. Si la demande mentionne un lieu ou un menu, reprendre un seul détail identifiable. Une table en vue de dessus risque d'occuper le centre. Mieux vaut la faire entrer par un bord. Côté chartes, nuages de baptême ou ballons d'anniversaire peuvent brouiller la lecture. Vérifier les ornements et privilégier une version sobre sur crème avec une encre foncée. « On s'occupe du reste » engage l'hôte, et cette fin disparaît de toute façon avec `anniversaire-confettis`.

**Retrouvailles**
- Bien : la nostalgie lumineuse et « Il ne manque plus que vous » installent un ton distinct. Josefin Sans et une palette ambre, crème et brun donnent une direction rétro cohérente.
- À corriger : les cadres vides peuvent ressembler à des emplacements pour des photos que le moteur n'ajoutera pas. Un détail de lieu ou d'époque, lorsqu'il est fourni, ancrera mieux l'image. « Comme au bon vieux temps » convient davantage à une promotion ou à des amis de longue date qu'à toutes les retrouvailles familiales. Employer « On se retrouve » comme défaut. Garder les ballons pour une fête explicitement annoncée et réserver l'or à l'accent sur bleu pétrole.

**Réunion**
- Bien : la géométrie et l'espace vide évitent les clichés de la poignée de main et de la salle de réunion. `seminaire-ondes`, avec Montserrat ou Poppins et le code couleur de l'organisation, convient au registre.
- À corriger : une réunion associative ne justifie pas à elle seule les nuages de `bapteme-douceur`. Une variante claire de `seminaire-ondes`, marine sur blanc, distingue mieux cette direction. « Vous êtes convié(e) » ajoute une parenthèse à une annonce par ailleurs sobre. « Réunion » suffit généralement, ou « Invitation à la réunion » si le titre n'en dit rien. Conditionner la demande de confirmation à une modalité réelle.

**Séminaire**
- Bien : les ondes, la priorité donnée à l'identité de l'organisation et l'écart entre Montserrat et Bebas Neue donnent une base professionnelle et une option d'affiche pour une soirée publique.
- À corriger : une silhouette d'Abidjan devrait dépendre du lieu ou du thème. Les particules et le vocabulaire de l'innovation conviennent davantage à certains sujets qu'à une formation quelconque. « Places limitées » invente une contrainte si elle n'est pas déclarée. Prévoir une classique institutionnelle et une moderne claire pour que toutes les variantes ne convergent pas vers le bleu nuit. Sur fond sombre, réserver le cyan ou l'or à l'accent et garder une encre claire pour le texte.

**Concert privé**
- Bien : l'intimité, la scène sans foule et la composition `festival-nuit-couleurs` distinguent bien la carte d'une invitation professionnelle. Bordeaux et crème offrent une option moins spectaculaire que le magenta. La fiche spécifie à juste titre des textes clairs sur fond sombre.
- À corriger : prévoir aussi le concert acoustique ou diurne. Garder le choix de l'instrument lié à la programmation fournie, comme le suggère déjà la fiche. « Une soirée rare, à vivre avec vous » sonne promotionnel et suppose le soir. « Venez vivre ce moment avec nous » couvre davantage de cas. Italiana peut convenir à un titre court, avec Poppins ou Montserrat pour les informations. Le « centre sombre » de l'illustration contredit la zone claire du prompt commun.

**Festival**
- Bien : Bebas Neue, Anton et les accents vifs sont cohérents avec l'esprit d'affiche. Les silhouettes lointaines et l'absence de sponsors inventés cadrent bien la scène. « Accès sur invitation » convient si c'est bien la règle d'accès.
- À corriger : un festival culturel ne suffit pas à justifier du wax, ni un festival de jour des ballons. Partir de la discipline ou du thème, puis choisir un motif ou une composition. « Présentez votre QR code à l'entrée » est refusé si `QR` est absent des faits et présume un contrôle à l'entrée. « Venez vibrer avec nous » passe le filtre. Sur crème, réserver jaune et turquoise aux ornements et garder une encre sombre pour les mentions.

**Autre**
- Bien : la demande et le thème passent en premier. L'illustration évite d'importer alliances, ballons et lys sans indication. Bleu nuit et blanc, ou sauge et crème avec une encre sombre, offrent de bons points de départ.
- À corriger : la partie propositions contredit cette neutralité en recommandant les confettis ou la nuit festive par défaut pour l'audacieuse. Préférer une composition graphique sobre et varier cadrage, échelle de titre et accent. « Save the date » contrevient à la règle du français et présente une annonce préalable là où la carte peut être une invitation définitive. « Rejoignez-nous » et « Votre présence nous ferait plaisir » restent utilisables.

## 3. Risques techniques vérifiés

**Les longueurs passent.** Longueurs des exemples de chaque fiche (surtitres, limite 40, puis fins, limite 90) :

| Type | Surtitres | Fins |
|---|---:|---:|
| Mariage | 17, 21, 17 | 33, 50 |
| Dot | 26, 16, 24 | 25, 36 |
| Baptême | 18, 18, 16 | 46, 47 |
| Funérailles | 11, 9, 13, 24 | 48, 52 |
| Anniversaire | 11, 13, 27 | 37, 39 |
| Brunch | 20, 21, 33 | 43, 47 |
| Retrouvailles | 14, 17, 24 | 26, 40 |
| Réunion | 19, 7, 23 | 38, 43 |
| Séminaire | 19, 9, 14 | 51, 37 |
| Concert privé | 13, 21, 14 | 34, 31 |
| Festival | 11, 11, 20 | 22, 34 |
| Autre | 19, 13, 14 | 47, 34 |

Le titre de mariage `Aïcha\n& Koffi` fait 13 caractères avec le retour à la ligne réel, pour une limite de 48. Les fiches ne donnent aucun exemple explicite de `tagline` (70) ou de `guestLabel` (36) à mesurer.

**`isGrounded` filtre des mots, avec des angles morts importants.** Sur des faits sans noms ni mention de `QR`, « Présentez votre QR code à l'entrée » est le seul exemple de surtitre ou de fin refusé. « Que Dieu vous bénisse » serait également refusé sans `Dieu` dans les faits, conformément à l'avertissement du README. À l'inverse, le premier mot de chaque ligne est exempté. `Aicha\n& Kofi` passe même lorsque les faits témoins ne contiennent aucun de ces prénoms. La comparaison retire aussi les accents et la casse. « Places limitées » passe sans preuve de capacité, et un nombre peut passer parce qu'il figure dans la date, même si le texte s'en sert pour inventer un âge. Le filtre remplace champ par champ les textes refusés. Une réponse hors schéma, par exemple un champ trop long, fait basculer l'ensemble vers les chartes de repli. Le schéma accepte aussi une à trois chartes sans vérifier l'unicité des directions.

**La composition décide de ce qui apparaît.** `anniversaire-confettis` n'a aucun emplacement `closing`, `dot-motifs-wax` cède cet emplacement à la tenue si elle existe, et seul `festival-nuit-couleurs` affiche `tagline`. Le prompt dit que la tenue est ajoutée par le moteur, mais seules les compositions anniversaire et dot ont un rôle dédié dans `composeCard`. Un texte validé peut aussi rétrécir fortement ou être ramené à une ligne selon le modèle. Les six JSON placent bien le sceau QR en bas à droite, à `x=776, y=988`. Le nom et la table ont leurs propres zones. Le catalogue décrit encore le sceau du mariage « au centre », et attribue au séminaire un programme que la composition retire. Ces descriptions alimentent directement le prompt système.

**Les consignes d'image doivent tenir compte de la mise en page réelle.** Avec des références, `imagePrompt.ts` demande de représenter fidèlement les personnes dans la moitié haute. Les interdictions générales de personnages dans les fiches anniversaire, baptême ou autre deviennent alors ambiguës. Pour les funérailles avec portrait, c'est le haut central qui doit rester uni pour le médaillon. Pour le concert, le « centre sombre » s'oppose à la zone centrale ou basse claire. La lumière du matin du brunch, la fin de journée des retrouvailles et la nuit du concert peuvent aussi contredire `facts.moment`. Les listes longues d'objets, les scènes de table et les termes « esprit d'affiche » ou « QR code » dans une description peuvent inciter le modèle à remplir les réserves ou à dessiner des signes. C'est un risque de génération, pas un résultat observé. La route exclut bien les photos de référence pour les funérailles et transmet `noText: true`. Cette option ajoute une instruction au fournisseur. Le respect du sans-texte dépend donc encore de l'image obtenue.

**Le contraste calculé aide, avec les limites du calcul.** Les polices proposées figurent au catalogue et les choix de police invité respectent la liste autorisée. Le moteur ajuste les couleurs des textes selon le fond estimé au centre de leur zone. Une image sous le texte peut ramener le calcul au fond de page, et la transparence du voile est ignorée dans le calcul du ratio. Un or pâle placé dans `accent` sert aussi au surtitre, à la mention invité et à certaines fins. Il peut donc être fortement modifié au rendu. Donner un rôle aux couleurs dans les fiches serait plus précis que lister « crème et or », notamment pour les petits textes et les noms longs sur un aperçu mobile.

## 4. Cinq améliorations prioritaires

1. **Fixer les règles de priorité avant l'injection.** Charger uniquement la section utile de la fiche sélectionnée. Pour l'image, remplacer le préprompt correspondant et laisser le code fixer les réserves selon `centre`, `photos` ou `portrait`. Faire primer le moment, le thème et les couleurs renseignés sur les valeurs par défaut. Pour les chartes, reprendre explicitement la règle existante qui impose le code couleur à la classique et laisse une marge aux deux autres directions.
2. **Sécuriser le titre à la source et corriger les formules.** Dériver le titre affiché des faits ou n'autoriser que des transformations contrôlées du titre saisi, comme le retour à la ligne. Retirer « Save the date » et la consigne avec `QR` des exemples. Conditionner « Places limitées », les demandes de confirmation et les mentions religieuses à un fait explicite. Aligner le texte de repli des funérailles sur cette dernière règle.
3. **Faire correspondre les fiches aux compositions réelles.** Corriger le catalogue sur le sceau du mariage et le programme du séminaire. Signaler au LLM les champs visibles par composition, en particulier la fin et l'accroche. Utiliser cette information avant de recommander une formule. Exiger une proposition par direction après assemblage, puis compléter avec le repli si une direction manque.
4. **Rendre l'ancrage local dépendant de l'événement.** Réécrire d'abord dot, mariage et festival. Pour la dot, choisir un motif ou un textile déclaré. Pour le mariage, donner des indications de matière et de décor tirées du lieu ou du thème. Pour le festival, faire dépendre les motifs de la discipline annoncée. Vérifier ces choix, ainsi que les formulations de deuil, auprès d'organisateurs ivoiriens sur des cartes complètes.
5. **Vérifier le résultat sur les cas qui mettent la carte en difficulté.** Avant branchement, contrôler automatiquement les exemples et les trois directions, puis examiner des rendus à taille de lecture WhatsApp. Couvrir au minimum un mariage aux noms longs, une dot avec tenue, des funérailles avec et sans portrait, un concert de jour et un événement avec une palette claire. Vérifier la lisibilité réelle, les phrases affichées, les zones recouvertes par les voiles, le sceau et l'absence de caractères dessinés.
