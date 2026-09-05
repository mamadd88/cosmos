# Cosmos

Application de gouvernance personnelle. Un **Cosmos** est un grand domaine de vie (une pièce) ; un **Mini-cosmos** est un terrain que tu gouvernes à l'intérieur (un meuble) : objectif, valeur actuelle, entropie et réponse, seuils Alerte / Kill, SAS d'entrée, étapes, échéance et projection dans le temps.

**En ligne :** https://cosmos-one-ashen.vercel.app

## Fichiers

- `Cosmos.dc.html` — l'interface (Cosmos, Échéances, Modèles, Journal). S'ouvre dans un navigateur.
- `cosmos-core.js` — le cœur métier, sans UI : statuts calculés, projection, système de dates, migration, données d'exemple, modèles.
- `cosmos-sync.js` — synchronisation avec la base (chargement, sauvegarde différentielle, relève de ce que les agents ont changé). Sans base configurée, l'app reste en localStorage.
- `support.js` — runtime nécessaire à `Cosmos.dc.html`.
- `api/` — fonctions serveur (Vercel) : `config.js` (configuration publique), `assist.js` (assistant IA), `agent.js` (porte des agents IA).
- `supabase/migrations/` — schéma de la base (tables, RLS, fonctions). `schema.md` décrit le modèle.
- `scripts/` — `creer-utilisateur.mjs` (compte unique), `etat-base.mjs` (aperçu de la base).

## Pages (routes)

`#/cosmos` (onglet **Cosmos**, vue d'arrivée) · `#/cosmos/<id>` (ouvre un mini-cosmos) · `#/echeances` · `#/modeles` · `#/journal` — les anciens `#/carte`, `#/tableau`, `#/statistiques` et `#/lentilles` mènent à `#/cosmos`

## Principes

- Le statut est calculé (SAS → Actif) ; seuls Pause et Clôturé sont manuels.
- Une échéance est une date (précise, fin de mois / trimestre / année) ou un **mandat d'un an** pour un objectif continu : au terme, tu le renouvelles si la discipline tient (bouton dans le volet, tracé dans le Journal), sinon tu clôtures ou tu supprimes. Plus rien n'est « permanent » : tout terrain a une date et une zone de projection. Les anciens exports avec « Permanent » sont convertis à l'import.
- Dans une pièce, des **titres** séparent les terrains, comme Ethos, Logos et Pathos séparent les pièces : « Calme » n'est pas un terrain, c'est une ligne qui regroupe Méditation et Respiration. Un titre n'a ni objectif ni date et ne compte pour rien. Il se crée avec « + titre » dans l'en-tête de la pièce, se renomme au double-clic, s'ordonne avec ↑ ↓, se supprime en laissant les terrains en place. Un terrain se range sous un titre en le glissant sur la ligne du titre ou parmi ses terrains, ou par le choix « Titre » du volet et du formulaire ; les terrains sans titre s'affichent avant le premier titre.
- Un cosmos, c'est là où une chose habite ; une **lentille** (tag), c'est ce qu'elle touche, à travers les cosmos (santé, une personne, l'argent…). Les lentilles se créent dans le formulaire, dans le volet ou dans la fenêtre Lentilles (menu Données ou puce « + lentille ») ; elles s'affichent en pastilles après le nom, filtrent la page Cosmos. Une dizaine au plus, sinon elles redeviennent des dossiers.
- Une page, un axe de lecture. **Cosmos** (page d'arrivée) : le travail par pièce — le tableau en sections, rangées sous **trois étages fixes**, dans l'ordre de chute : **Ethos** (ce qui porte l'opérateur), **Logos** (ce qu'il fait tourner), **Pathos** (ce pour quoi tout existe). Le domino se lit à l'intérieur de chaque étage : chaque pièce porte son numéro (E1, L2, P3…), calculé depuis sa position dans son étage et repris partout où elle est nommée ; la règle de lecture est écrite sous la page : « Si un cosmos tombe, il entraîne le suivant. » Chaque étage a un titre centré et, dessous, un repère en gras éditable d'un clic ; une pièce change d'étage en la glissant sur une autre pièce ou sur l'en-tête de l'étage, et l'étage d'une nouvelle pièce se choisit dans la fenêtre « + cosmos ». En tête, un bandeau de KPI est la ligne Total de la bande : mini-cosmos ouverts, SAS, pause, datés, mandats, tension, retard — mêmes mots, mêmes couleurs, calculés sur tout le système sans tenir compte des filtres. Repliées, les sections forment le tableau de bord : une ligne par pièce, mêmes colonnes pour toutes (thermomètre, SAS, pause, datés, mandats, tension, retard, zéros compris), les points de poids et l'alerte. Chaque pièce porte aussi un **repère**, sa règle du jeu en une phrase, éditable d'un clic dans la bande et lu par les agents comme description de la catégorie. **Échéances** : le temps — tout ce qui a une date, de la plus proche à la plus lointaine, SAS et mandats compris, avec les filtres de zone, délai, trimestre, mois et année. **Journal** : l'historique, avec l'activité de la période en tête. Sur Cosmos, chaque section est un accordéon : un clic sur l'en-tête la replie ou la déplie, l'état est mémorisé dans le navigateur, « Tout ouvrir » et « Tout fermer » agissent d'un coup, et l'ordre des sections se change par glisser-déposer ou avec les boutons ↑ ↓.
- **En ligne** : base Supabase (projet `cosmos`), un seul utilisateur, connexion par email + mot de passe. Chaque changement est sauvegardé en différentiel dans une transaction ; ce que les agents écrivent est relevé toutes les 30 s et au retour sur l'onglet.
- **En local** (fichier ouvert sans serveur) : sauvegarde automatique dans le navigateur. À la première connexion sur une base vide, les données locales de ce navigateur sont reprises.
- Menu Données (icône base, en haut à droite) : exporter / importer un JSON, restaurer l'exemple, gérer les agents IA, se déconnecter. Le journal garde 12 mois « vivants » à l'écran ; l'export inclut l'archive complète.

## Agents IA

Menu Données › **Agents IA** › Nouvel agent : la clé s'affiche une seule fois. Deux niveaux :

| Niveau | Ce que l'agent peut faire |
|---|---|
| Propositions (défaut) | `lire` (renvoie aussi les lentilles existantes), `proposer`, `noter` — une proposition apparaît dans le volet Assistant du mini-cosmos, à accepter ou refuser |
| Écriture directe | en plus : `modifier` — appliqué immédiatement, toujours tracé dans le Journal avec le nom de l'agent |

```bash
# documentation de la porte
curl https://cosmos-one-ashen.vercel.app/api/agent

# lire l'état complet
curl https://cosmos-one-ashen.vercel.app/api/agent -H "Authorization: Bearer <clé>" \
  -H "Content-Type: application/json" -d '{"action":"lire"}'

# proposer un changement (champs : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes, tags, poids)
curl https://cosmos-one-ashen.vercel.app/api/agent -H "Authorization: Bearer <clé>" \
  -H "Content-Type: application/json" \
  -d '{"action":"proposer","mini_id":"mc-01","patch":{"alerte":"< 4 500 € au j20","etapes":["Tester 2 audiences"]},"motif":"marge trop faible avant le kill"}'
```

Révoquer un agent : même fenêtre, bouton Révoquer (sa clé cesse de fonctionner immédiatement).

## Lancer en local

Avec les fonctions serveur (nécessite `.env` — copie de `.env.local`, voir `.env.example`) :

```bash
npm install
npx vercel dev --listen 8123
```

Puis http://localhost:8123. Sans variables Supabase, l'app tourne en mode local (localStorage, sans connexion).

## Déployer

```bash
npx vercel deploy --prod
```

Variables d'environnement Vercel : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (déjà en place), `ANTHROPIC_API_KEY` (à ajouter pour activer l'assistant : `vercel env add ANTHROPIC_API_KEY production`).

## Base de données

```bash
# appliquer une nouvelle migration (supabase/migrations/*.sql) sur le projet lié
npx supabase db push

# créer ou changer le mot de passe de l'utilisateur unique
node --env-file=.env.local scripts/creer-utilisateur.mjs <email> <mot-de-passe>
# sans mot de passe en argument, la valeur COSMOS_PASSWORD de .env.local est utilisée

# aperçu de la base
node --env-file=.env.local scripts/etat-base.mjs
```

## Pousser sur GitHub

```bash
git add . && git commit -m "Cosmos — base Supabase, agents IA, déploiement Vercel"
git push
```
