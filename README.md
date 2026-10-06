# Cosmos

Application de gouvernance personnelle. Un **Cosmos** est un grand domaine de vie (une pièce) ; un **Mini-cosmos** est un terrain que tu gouvernes à l'intérieur (un meuble) : objectif, valeur actuelle, entropie et réponse, seuils Alerte / Kill, SAS d'entrée, étapes, échéance et projection dans le temps.

**En ligne :** https://cosmos-one-ashen.vercel.app

## Architecture

L’interface utilise **React 19 + TypeScript + Vite + React Router 8**, en mode SPA. Les pages et les volets sont compilés au build et chargés à la demande. Il n’y a plus de moteur de templates HTML exécuté dans le navigateur, ni de téléchargement de React depuis un CDN.

- `app/routes/` — pages Cosmos, Échéances, Modèles et Journal.
- `app/components/` — en-tête, formulaires, volets et états de chargement.
- `app/state/CosmosController.js` — état et opérations de l’interface, observés par React avec `useSyncExternalStore`. Le contrôleur et le cœur métier restent en JavaScript ; le typage des collections métier est progressif.
- `app/state/startup-cache.ts` — copie d’affichage par compte et projet, valable 24 h, sans Journal ni jeton. Après identification, elle s’affiche en lecture seule jusqu’à la réponse Supabase. Elle est effacée à la déconnexion et ne sert jamais de source de sauvegarde.
- `cosmos-core.js` — statuts calculés, projections, dates, migrations de données, exemples et modèles.
- `cosmos-sync.js` — chargement Supabase, sauvegardes différentielles et synchronisation des suppressions et structures.
- `api/` — fonctions Vercel : assistant IA et accès des agents.
- `supabase/migrations/` — schéma, RLS et fonctions PostgreSQL ; `schema.md` décrit le modèle.
- `tests/` — régressions métier, synchronisation, cache et interactions React dans un DOM simulé, sans tests visuels.

## Pages

`/cosmos` · `/cosmos/<id>` · `/echeances` · `/echeances/<id>` · `/modeles` · `/journal`.

Les favoris historiques `#/…` sont convertis au démarrage sans recharger le document. Les routes `carte`, `tableau`, `statistiques` et `lentilles` redirigent vers Cosmos, en conservant les liens directs vers les fiches.

## Chargement et capacité

La configuration publique Supabase est intégrée au build : l’interface démarre sans requête de configuration. Seuls l’URL et la clé publique Supabase sont inclus dans le client ; les clés de service et Anthropic restent côté serveur. Une modification de configuration nécessite un nouveau build.

Les assets compilés portent un nom versionné pour leur mise en cache. Les volets s’importent à l’ouverture. La relève Supabase s’arrête pendant que l’onglet est masqué et reprend à son retour. Le premier accès à un compte attend toujours les données réseau ; les rechargements suivants peuvent afficher la copie locale pendant cette attente.

Cette migration facilite l’évolution de l’interface. La RPC actuelle charge encore l’état complet et le Journal vivant : pour de très grands volumes, la pagination serveur, le chargement ciblé par page et des mesures sous charge restent nécessaires. Aucun gain de temps précis ni capacité maximale n’est déduit du seul changement de framework.

## Principes

- Le statut est calculé (SAS → Actif) ; seuls Pause et Clôturé sont manuels.
- Une échéance est une date (précise, fin de mois / trimestre / année) ou un **mandat d'un an** pour un objectif continu : au terme, tu le renouvelles si la discipline tient (bouton dans le volet), sinon tu clôtures ou tu supprimes. Les créations rapides peuvent rester sans date pendant leur préparation en pause. Les anciens exports avec « Permanent » sont convertis à l'import.
- Dans un cosmos, les **séparations internes** regroupent les mini-cosmos sous des tags. Le menu du cosmos permet d’en ajouter une ; le menu `···` de chaque séparation permet de la modifier ou de la supprimer. Le renommage met à jour tous ses mini-cosmos, même masqués par un filtre. La suppression conserve les mini-cosmos dans leur cosmos, sans séparation. Les mini-cosmos sans séparation apparaissent en premier ; le glisser-déposer les range sous un tag ou dans un autre cosmos. Le choix de la séparation reste également disponible dans le volet et le formulaire.
- **Cosmos** (page d’arrivée) : trois tableaux pleine largeur, dans l’ordre **PATHOS — L’ÉNERGIE**, **ETHOS — LA CRÉDIBILITÉ**, puis **LOGOS — L’ORDRE**. La première colonne regroupe les groupes, cosmos et mini-cosmos ; les cosmos sans groupe précèdent les groupes nommés. Les noms n’ont aucun préfixe ni numérotation. Toute la ligne d’un étage, d’un groupe ou d’un cosmos ouvre ou ferme son accordéon, et les commandes restent indépendantes. Les accordéons sont fermés par défaut ; les ouvertures sont mémorisées dans le navigateur, y compris celles de l’ancienne page d’essai. Le bandeau global compte cosmos, mini-cosmos ouverts, SAS, pauses, datés, mandats, tensions et retards, indépendamment des filtres. Les colonnes Alerte et Kill gardent leurs couleurs ; Statut précède Projection. Cliquer une ligne de mini-cosmos ouvre sa fiche latérale ; le badge de statut permet la pause/reprise et le compteur d’étapes ouvre leur détail.
- **En ligne** : base Supabase (projet `cosmos`), données isolées par utilisateur via RLS, connexion par email + mot de passe. Chaque changement est sauvegardé en différentiel dans une transaction. Toutes les 30 s et au retour sur l'onglet, un état complet récupère aussi les suppressions, les réordonnancements, les titres et les étages modifiés ailleurs. Cette relève est différée pendant une édition ou une sauvegarde locale ; une réponse devenue ancienne pendant la requête est ignorée.
- **Sans configuration Supabase** (serveur Vite local) : sauvegarde automatique dans le navigateur. À la première connexion sur une base vide, les données locales de ce navigateur sont reprises.
- **Édition** : « Modifier » ouvre un brouillon. « Terminer », la fermeture du volet ou un changement de page valident puis enregistrent la fiche et son Journal ensemble. Un nom vide ou doublonné, une gouvernance incomplète ou des dates incohérentes bloquent la validation. « Annuler » abandonne le brouillon.
- **Création rapide** : le champ en bas de chaque tableau ouvert crée un mini-cosmos avec son nom seul, via Entrée ou « Ajouter ». Il reste prêt pour la saisie suivante ; Échap efface la saisie. La nouvelle fiche est en pause, sans dates ni mandat automatiques, sous le dernier titre interne s’il existe. Les filtres du tableau sont réinitialisés pour montrer le résultat. On peut compléter et enregistrer la fiche progressivement ; « Reprendre » exige l’entropie, sa réponse et des dates cohérentes (y compris la fin du test si un SAS est prévu). Une date de début future programme le démarrage. La création ne produit aucun événement dans le Journal ; seuls les changements de Valeur actuelle sont journalisés.
- **Clôture** : `cloture` conserve l’échéance prévue, `closedAt` mémorise la date effective. Réouvrir préserve donc les dates et le mandat. Les anciennes fiches déjà clôturées gardent leur date historique ; leur échéance antérieure, déjà écrasée, ne peut pas être reconstruite automatiquement.
- **Groupes dans les étages** : « + Groupe » crée un groupe dans Ethos, Logos ou Pathos. Son menu permet de le modifier ou de le supprimer, en conservant ses cosmos dans le même étage. Glisser directement une ligne (ou son nom) déplace un groupe, un cosmos ou un mini-cosmos, avec le même mécanisme natif que la poignée et sans délai ajouté. Le clic simple ouvre la ligne, le relâchement dépose l’élément, et Échap annule. Les tags, champs et menus gardent leur action ; les poignées restent disponibles, y compris au clavier. Un dépôt conserve les ouvertures des accordéons : une destination fermée reste fermée. Le menu d’un cosmos permet de le modifier, de le supprimer ou d’ajouter une séparation interne. Les données restent synchronisées et incluses dans les exports, sans événement supplémentaire dans le Journal.
- **Écritures concurrentes** : `sync_etat_v4` fusionne uniquement les champs modifiés par le client, après comparaison avec sa version de référence sous verrou PostgreSQL. Les modifications incompatibles, les suppressions et les structures périmées produisent un conflit explicite. La copie locale reste dans l’onglet, exportable avant rechargement ; les retries automatiques ne forcent jamais un conflit. Les versions précédentes restent en base car chacune appelle la suivante (`sync_etat_v4` → `v3` → `v2` → `sync_etat`, et de même pour `charger_etat_v4`) ; seule la v4 est appelée par l’interface.
- **Changement de jour** : la date de calcul est actualisée toutes les 30 s, avant le rendu et au retour sur l'onglet, y compris en mode local ; statuts et projections suivent le nouveau jour sans recharger la page.
- **Échéances** : les fiches actives et celles dont le début est futur (« À venir ») apparaissent ; les pauses manuelles et les fiches clôturées sont exclues. Les filtres d’année, mois et trimestre restent cohérents, et les menus conservent les années présentes dans les données ou sélectionnées. Les délais 7 / 30 / 90 j couvrent aujourd’hui jusqu’à la borne choisie, sans les retards ; « Tous » inclut aussi le passé. Les compteurs des boutons annoncent le résultat du clic en conservant les autres filtres, les KPI suivent la liste affichée, et « Réinitialiser les filtres » efface aussi la recherche. Les lignes s’ouvrent au clavier avec Tab puis Entrée ou Espace.
- **Journal** : l’activité est calculée depuis les événements conservés sur 12 mois, même après suppression d’une fiche, avec les mêmes filtres que la liste. Les périodes de 7 / 30 / 90 jours suivent le calendrier local, aujourd’hui inclus, et les comparaisons utilisent la période précédente avec les mêmes critères. Les compteurs de type et d’auteur annoncent le résultat du clic. Les valeurs avant/après des modifications sont consultables et recherchables en entier ; les nouvelles propositions IA appliquées les enregistrent aussi. Les anciennes valeurs jamais enregistrées ne peuvent pas être reconstituées. Une entrée ouvre sa fiche au clavier uniquement lorsqu’elle possède un identifiant encore présent ; un nom réutilisé ne recrée pas de lien.
- Menu Données (icône base, en haut à droite) : exporter / importer un JSON, restaurer l'exemple, gérer les agents IA, se déconnecter. Le Journal enregistre uniquement les changements réels de **Valeur actuelle**, avec les valeurs avant/après. Les autres champs sont sauvegardés sans événement ; les créations, étapes, statuts, imports et notes ne sont pas journalisés. Il garde 12 mois « vivants » à l'écran ; l'export inclut l'archive complète.

- **Repli des étages** : fermer un étage conserve le repli de ses enfants et les saisies rapides en cours. « Tout ouvrir » et « Tout fermer » agissent sur les trois niveaux. La recherche et le survol pendant un déplacement révèlent temporairement les résultats sans écraser les préférences ; créer un cosmos ou un mini-cosmos depuis l’en-tête révèle le résultat.

## Agents IA

Menu Données › **Agents IA** › Nouvel agent : la clé s'affiche une seule fois. Deux niveaux :

| Niveau | Ce que l'agent peut faire |
|---|---|
| Propositions (défaut) | `lire`, `proposer` — une proposition apparaît dans le volet Assistant du mini-cosmos, à accepter ou refuser |
| Écriture directe | en plus : `modifier` — appliqué immédiatement, seuls les changements de Valeur actuelle sont tracés avec le nom de l'agent |

```bash
# documentation de la porte
curl https://cosmos-one-ashen.vercel.app/api/agent

# lire l'état complet
curl https://cosmos-one-ashen.vercel.app/api/agent -H "Authorization: Bearer <clé>" \
  -H "Content-Type: application/json" -d '{"action":"lire"}'

# proposer un changement (champs : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes, poids)
curl https://cosmos-one-ashen.vercel.app/api/agent -H "Authorization: Bearer <clé>" \
  -H "Content-Type: application/json" \
  -d '{"action":"proposer","mini_id":"mc-01","patch":{"alerte":"< 4 500 € au j20","etapes":["Tester 2 audiences"]},"motif":"marge trop faible avant le kill"}'
```

Révoquer un agent : même fenêtre, bouton Révoquer (sa clé cesse de fonctionner immédiatement).

## Lancer en local

Node.js **22.22.3 ou plus récent dans la branche 22**. Copier les paramètres nécessaires de `.env.example` dans `.env.local` ; Vite charge ce fichier pour l’interface et les deux API locales.

```bash
npm ci --include=dev
npm run dev
```

Puis ouvrir [localhost:8123](http://localhost:8123/cosmos). Sans variables Supabase, l’app utilise localStorage et les données d’exemple.

```bash
npm run typecheck
npm test
npm run build
npm run test:build
npm run preview
```

L’aperçu du build fonctionne sur [localhost:8124](http://localhost:8124/cosmos), avec les mêmes API locales. Le build statique se trouve dans `build/client`.

`test:build` charge les vrais modules compilés dans un DOM simulé, contrôle le démarrage et les anciens favoris, et vérifie que les clés serveur disponibles dans l’environnement n’apparaissent pas dans les assets publics.

La suite PostgreSQL de `tests/cosmos-database.test.mjs` nécessite une base locale jetable, les migrations appliquées et les variables `COSMOS_TEST_PG_SOCKET` (socket sous `/tmp/`) et `COSMOS_TEST_PG_PORT`. Elle teste les RPC réelles avec des comptes fictifs supprimés après chaque scénario ; sans ces variables, seuls ces tests d’intégration sont ignorés.

## Déployer sur Vercel

Le projet Vercel est relié au dépôt GitHub : chaque push sur `main` déclenche un déploiement de production. Vérifier avant de pousser :

```bash
npm run typecheck
npm test
git push
```

`vercel.json` configure le build Vite, publie `build/client` et redirige les pages vers `index.html`. Les chemins `/api/*` restent des fonctions Vercel et les assets sont servis directement.

Variables Vercel : `SUPABASE_URL` et `SUPABASE_ANON_KEY` (requises au build pour activer le compte Supabase), `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement) et `ANTHROPIC_API_KEY` (serveur, assistant facultatif). Les variables publiques du build doivent viser le même projet que les API.

Pour `vercel build --prod` en local, Vercel peut écrire `[SENSITIVE]` à la place des variables protégées téléchargées. Remplacer ces valeurs dans le fichier ignoré `.vercel/.env.production.local` par les valeurs locales du même projet. Le build refuse une configuration publique partielle ou masquée. Un déploiement construit sur Vercel reçoit directement ses variables réelles.

## Base de données

```bash
# appliquer une nouvelle migration (supabase/migrations/*.sql) sur le projet lié
npx supabase db push

# créer ou changer le mot de passe d’un utilisateur
node --env-file=.env.local scripts/creer-utilisateur.mjs <email> <mot-de-passe>
# sans mot de passe en argument, la valeur COSMOS_PASSWORD de .env.local est utilisée

# aperçu de la base
node --env-file=.env.local scripts/etat-base.mjs
```

Les trois titres d’espace sont personnalisables avec « Modifier », à côté de « + Groupe ». La fenêtre conserve le repli et les filtres. Le titre complet (1–300 caractères) est enregistré dans `titresEtages`, exporté et synchronisé entre appareils, sans événement de Journal. Les identifiants `ethos`, `logos`, `pathos` restent stables pour les groupes, le déplacement et les préférences d’ouverture.

Dans chaque ligne de groupe, le crayon (ou « Modifier » dans le menu) permet de renommer directement le titre, avec Entrée pour enregistrer et Échap pour annuler. « + Cosmos » ouvre une création rattachée automatiquement à ce groupe et à son espace, même si le groupe est vide ou replié. Le nom du cosmos et son appartenance sont sauvegardés ensemble ; le nouveau cosmos est placé en tête de son groupe et reste fermé après création, sans modifier les filtres ni les ouvertures des groupes et espaces.

Les lignes de cosmos et mini-cosmos proposent un bouton de suppression à côté du crayon. Une confirmation précède la suppression ; le cosmos supprime également ses mini-cosmos. La suppression d’un mini-cosmos retire ses références des dépendances des autres fiches, sans ajouter d’événement au journal.
