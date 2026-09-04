# Cosmos

Application de gouvernance personnelle. Un **Cosmos** est un grand domaine de vie (une pièce) ; un **Mini-cosmos** est un terrain que tu gouvernes à l'intérieur (un meuble) : objectif, valeur actuelle, entropie et réponse, seuils Alerte / Kill, SAS d'entrée, étapes, échéance et projection dans le temps.

**En ligne :** https://cosmos-one-ashen.vercel.app

## Fichiers

- `Cosmos.dc.html` — l'interface (Tableau, Modèles, Statistiques, Journal). S'ouvre dans un navigateur.
- `cosmos-core.js` — le cœur métier, sans UI : statuts calculés, projection, système de dates, migration, données d'exemple, modèles.
- `cosmos-carte.js` — la page Carte (React Flow chargé à la demande, sans build) : pièces, terrains et liens « dépend de ».
- `cosmos-sync.js` — synchronisation avec la base (chargement, sauvegarde différentielle, relève de ce que les agents ont changé). Sans base configurée, l'app reste en localStorage.
- `support.js` — runtime nécessaire à `Cosmos.dc.html`.
- `api/` — fonctions serveur (Vercel) : `config.js` (configuration publique), `assist.js` (assistant IA), `agent.js` (porte des agents IA).
- `supabase/migrations/` — schéma de la base (tables, RLS, fonctions). `schema.md` décrit le modèle.
- `scripts/` — `creer-utilisateur.mjs` (compte unique), `etat-base.mjs` (aperçu de la base).

## Pages (routes)

`#/carte` (onglet **Cosmos**, vue d'arrivée) · `#/carte/<id>` · `#/tableau` · `#/tableau/<id>` (ouvre un mini-cosmos) · `#/modeles` · `#/statistiques` · `#/journal`

## Principes

- Le statut est calculé (SAS → Actif) ; seuls Pause et Clôturé sont manuels.
- Une échéance est une date (précise, fin de mois / trimestre / année) ou un **mandat d'un an** pour un objectif continu : au terme, tu le renouvelles si la discipline tient (bouton dans le volet, tracé dans le Journal), sinon tu clôtures ou tu supprimes. Plus rien n'est « permanent » : tout terrain a une date et un contour sur la carte. Les anciens exports avec « Permanent » sont convertis à l'import.
- Un cosmos, c'est là où une chose habite ; une **lentille** (tag), c'est ce qu'elle touche, à travers les cosmos (santé, une personne, l'argent…). Les lentilles se créent dans le formulaire, dans le volet ou dans la fenêtre Lentilles (menu Données ou puce « + lentille ») ; elles s'affichent en pastilles après le nom, filtrent le tableau et ont leur répartition dans les statistiques. Une dizaine au plus, sinon elles redeviennent des dossiers.
- La **Carte** (onglet Cosmos, première page à l'arrivée) dessine les pièces et leurs terrains, toutes les cartes à la même taille : le point dit le poids, le contour dit la date (vert tenue, bleu test en cours, ambre en tension, rouge en retard), la flèche dit « dépend de ». Chaque pièce porte une barre vert / ambre / rouge / gris : c'est le thermomètre du cosmos, une pièce très verte est saine, une pièce rouge pose problème. On trace un lien du bord droit d'une carte vers celle qui en dépend ; la flèche s'anime quand l'amont est en tension ou en retard, parce que les dangers d'un cosmos vivent presque toujours dans un autre. Clic sur une carte : le volet ; clic sur une pièce : le tableau filtré ; pour retirer un lien : la petite croix à mi-chemin du lien, ou lien sélectionné + Retour arrière. Les liens apparaissent aussi dans le volet (« dépend de », « alimente »). Les mini-cosmos en pause ou clôturés n'y figurent pas : la carte montre ce qui tourne, le titre de la pièce rappelle combien sont en pause.
- Chaque mini-cosmos a un **poids** : vital, important ou normal (défaut), choisi à la création et modifiable dans le volet ou d'un clic sur le point devant le nom. Structurel, pas un état : il fait remonter les vitaux puis les importants en tête de leur cosmos, place les vitaux en premier dans les échéances, allume un point sur Tension / Jour J / Retard quand un vital y est, et hiérarchise les propositions de l'assistant et des agents.
- Un SAS porte sa propre date de fin (7 / 14 / 30 j ou date libre, 14 j par défaut). Tant qu'il n'est pas franchi, la ligne vit au rythme du test : colonne Clôture avec badge SAS, jauge et filtres sur cette date. Un test n'a que deux états : bleu tant qu'il dure, rouge s'il est dépassé, jamais d'ambre. SAS coché : tout bascule vers l'échéance finale. Test dépassé : rouge, et c'est toi qui tranches (admettre, déplacer la date, clôturer).
- La projection alerte sur le temps ; la valeur actuelle face aux seuils se juge à l'œil — jamais de corrélation automatique.
- L'assistant IA (volet gauche d'un mini-cosmos) relit ce que tu as écrit et propose ; rien n'est appliqué sans clic, tout est tracé dans le Journal.
- Les agents IA passent par **une seule porte** (`/api/agent`), chacun avec sa propre clé ; par défaut ils **proposent**, et seuls les agents que tu autorises un par un **écrivent directement**. Jamais de clé `service_role` donnée à un agent.

## Données

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
