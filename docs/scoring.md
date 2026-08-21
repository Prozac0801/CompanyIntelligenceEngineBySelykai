# Intelligence Scoring V0.4

La V0.4 sépare les questions métier au lieu de présenter un unique score « Opportunity » comme vérité centrale.

## Les cinq axes

| Axe | Question | Lecture |
| --- | --- | --- |
| Prospect Fit | Cette entreprise correspond-elle structurellement à une cible exploitable ? | 0–100 |
| Momentum | Existe-t-il un déclencheur récent et documenté ? | 0–100 ou **données insuffisantes** |
| Commercial Access | Dispose-t-on de points d’entrée et d’une présence exploitable ? | 0–100 |
| Risk Exposure | Les sources couvertes révèlent-elles des signaux de vigilance ? | 0–100, **0 = faible exposition** |
| Data Confidence | Quelle part des familles de preuves est réellement couverte ? | 0–100 |

Un axe manquant n’est jamais remplacé par une fausse note moyenne. En particulier, `Momentum = null` signifie **aucun déclencheur récent suffisamment documenté**.

## Décision commerciale

La décision affichée est distincte des sous-scores :

- `triggered` : Fit suffisant + Momentum réel + risque maîtrisé ;
- `watch` : profil à surveiller, signaux insuffisants ou risque nécessitant une vérification ;
- `not-determined` : données insuffisantes pour prioriser.

Une **procédure BODACC critique récente** ou une entreprise administrativement fermée constitue un hard-stop : le moteur ne peut pas produire `triggered`, même si le Fit et le Momentum sont élevés.

## BODACC et temporalité

La famille « procédures collectives » ne suffit pas à qualifier un événement de critique : elle contient aussi des jugements de clôture et des plans. Le moteur analyse le libellé et le détail du jugement :

- ouverture / liquidation / redressement / sauvegarde / conversion : critique ;
- clôture / plan / continuation / cession / extinction : vigilance ;
- création / immatriculation : positif ;
- radiation / conciliation : vigilance.

Le risque tient aussi compte de la récence. Un événement critique récent pèse davantage qu’un événement historique. Une clôture n’est pas assimilée à une procédure active.

Les dépôts de comptes routiniers restent des preuves juridiques utiles mais **ne créent pas à eux seuls du Momentum commercial**.

## Finances

Les indicateurs financiers sont calculés uniquement lorsque les valeurs publiques existent réellement :

- chiffre d’affaires ;
- résultat net ;
- marge nette = résultat net / chiffre d’affaires ;
- évolution du CA et du résultat si plusieurs exercices sont disponibles.

`null`, chaîne vide ou valeur non numérique ne sont jamais convertis en zéro. Une marge faible ou un résultat négatif alimentent `Risk Exposure`, sans être présentés comme une analyse de solvabilité.

## Score historique de compatibilité

Le champ numérique `score.value` reste conservé pour compatibilité avec l’API, l’historique et le benchmark existant. Il s’agit d’un **indice interne de priorité**, pas de la décision principale de l’interface et pas d’un percentile national.

La décision utilisateur doit lire `score.opportunity` et les cinq sous-scores.

## Confiance et couverture

Les familles actuellement suivies sont : données légales, RNE, BODACC, Web/SERP, firmographie web, actualités et historique interne.

Le pourcentage de couverture mesure la présence de ces familles ; il ne transforme pas une source absente en donnée négative.

## Benchmark

Le benchmark n’est affiché que lorsqu’un échantillon comparable suffisant existe avec **la même version de scoring**. Le seuil minimum reste 20 entreprises comparables dans la même division NAF.

## Versionnement

Version courante : `intelligence-v0.4.1`.

Toute modification significative des règles de décision, du sens d’un axe ou des seuils doit créer une nouvelle version. Les benchmarks ne doivent jamais mélanger plusieurs versions.
