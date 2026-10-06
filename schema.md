# Cosmos — schéma de données

L'export JSON de l'application (`version: 1`) contient `cosmos[]`, `miniCosmos[]` (objets complets), `journal[]` et `journalArchive[]`. En base, chaque mini-cosmos est stocké tel quel dans une colonne `data` (jsonb) : le format ci-dessous est donc à la fois celui de l'export et celui de la base.

## Concepts (rappel)
- **Cosmos** : grand domaine de vie (pièce). **Mini-cosmos** : terrain gouverné à l'intérieur (meuble).
- **Statut** — calculé, sauf deux drapeaux manuels : `Clôturé` (closed) > `Pause` (pause manuelle, ou date de début future) > `SAS` (champ SAS rempli et non franchi) > `Actif`.
- **Échéance** — soit une date (précise, fin de mois, fin de trimestre, fin d'année), soit un **mandat d'un an** (`A:AAAA-MM-JJ`, objectif continu revu au terme puis renouvelé ou supprimé). `Permanent` n'existe plus : converti en mandat à la migration.
- **Projection** — calculée : avancement dans le temps entre début et échéance ; zone `ok | tension | jourj | retard | continu | termine`, la tension démarrant `alertDays` jours avant l'échéance.
- **SAS** — test d'entrée borné ; c'est la première étape du mini-cosmos tant qu'il n'est pas franchi.

## Règles calculées (non stockées)
- `statut` (voir ci-dessus) · échéance résolue = dernier jour du mois / trimestre / année, ou la date
- Ordre d'affichage : statut (Actif → SAS → Pause → Clôturé) puis `position` ; drag & drop uniquement au sein d'un même statut
- Projection : `pct = (aujourd’hui − startAt) / (échéance − startAt)` borné 0–100 ; `days = échéance − aujourd’hui` ; zone selon `alertDays`
- Compteur d'étapes = done / total (le SAS n'y compte pas)

## Format d’un mini-cosmos (export JSON et colonne `data`)

| Champ | Contenu |
|---|---|
| `id` | identifiant stable (ex. `mc-01`) |
| `cosmos` | nom du cosmos |
| `name`, `objectif`, `actuel`, `entropie`, `reponse` | nom, objectif, valeur actuelle, entropie et réponse à l’entropie |
| `alerte`, `kill` | seuils libres |
| `sas` (`—` ou vide ⇒ pas de SAS), `sasUntil`, `sasDone` | test d’entrée, sa date de fin, franchi ou non |
| `pause`, `closed`, `closedAt` | drapeaux manuels ; date effective de clôture |
| `startAt` (absent ⇒ `createdAt`, sauf brouillon) | date de début |
| `cloture` : `AAAA-MM-JJ` / `M:AAAA-MM` / `Q:AAAA-Qn` / `Y:AAAA` / `A:AAAA-MM-JJ` | échéance : date, fin de mois / trimestre / année, ou mandat d’un an |
| `alertDays` (absent ⇒ 7) | préavis de tension |
| `poids` | `vital`, `important` ou `normal` |
| `titre` | séparation du cosmos sous laquelle il est rangé |
| `draft` | fiche créée rapidement, à compléter |
| `actions[]` `{text, done}` | étapes |
| `history[]` `{t, type, value}` | historique compact |

Entrée de Journal : `{id, t, author, type, mini, miniId, cosmos, detail, changes}`. Champs hérités ignorés à l’import : `statut` (recalculé), `etat`, `type`, `maintenance`.

## Ce qui est en base (Supabase)

**Un mini-cosmos = une ligne dont `data` (jsonb) contient l’objet complet de l’app**, avec des **colonnes générées** (`name`, `cosmos`, `objectif`, `valeur_actuelle`, `entropie`, `reponse_entropie`, `seuil_alerte`, `seuil_kill`, `sas`, `sas_done`, `pause`, `closed`, `start_at`, `cloture`) pour requêter en SQL. Les étapes sont exposées par la vue `etapes` (déplie `data->'actions'`) ; l’historique compact (`history[]`) reste dans `data`.

| Table / vue | Rôle |
|---|---|
| `cosmos` | domaines de vie : `(user_id, name)` clé, `position`, `etage` (`ethos`, `logos` ou `pathos` : les trois étages fixes, dans l'ordre de chute), `titres` (liste ordonnée des séparations de la pièce) |
| `etages` | le repère de chaque étage : `(user_id, etage)` clé, `repere` |
| `mini_cosmos` | une ligne par mini-cosmos : `id` (celui de l'app), `data` jsonb, `position`, colonnes générées (dont `sas_until`, fin du test d'entrée, et `poids` : vital / important / normal), `updated_at`, `updated_by` (« Toi » ou nom d'agent) |
| `etapes` (vue) | `mini_cosmos_id`, `position`, `texte`, `done` |
| `journal` | changements de Valeur actuelle uniquement : `t` (horodatage de l'auteur), `created_at` (serveur), `author`, `type = modification`, `mini_id` sans FK, `changes` jsonb avant/après |
| `agents` | une clé par agent : `key_hash` (SHA-256, jamais la clé), `ecriture_directe`, `actif`, `last_used_at` |
| `propositions` | suggestions d'agents : `patch` jsonb (objectif, actuel, entropie, reponse, sas, alerte, kill, etapes), `motif`, `statut` en_attente / acceptee / refusee |
| `cosmos_sections` | groupes de chaque étage : `(user_id, id)` clé, `name`, `etage`, `position` ; `cosmos.section_id` facultatif |
| `cosmos_titres_etages` | titre personnalisé de chaque espace : `(user_id, etage)` clé, `titre` (1–300 caractères) |

Toutes les tables portent `user_id` et une politique RLS `user_id = auth.uid()` ; `anon` n'a aucun accès.

**Fonctions côté app** (droits de l'utilisateur connecté) : `charger_etat_v4()` (tout l'état en un appel, journal des 12 derniers mois), `sync_etat_v4(...)` (sauvegarde différentielle en une transaction avec détection des conflits, ou remplacement complet à l'import), `creer_agent(nom, ecriture_directe)` (renvoie la clé une seule fois). Chaque version ajoute une partie de la structure puis appelle la précédente : `charger_etat_v4` → `charger_etat_v3` → `charger_etat` et `sync_etat_v4` → `sync_etat_v3` → `sync_etat_v2` → `sync_etat`. Les versions antérieures restent donc nécessaires, même si l'interface n'appelle que la v4.


**Titres** : `cosmos.titres` (jsonb, liste ordonnée de noms) sépare les terrains d'une pièce ; `data->>'titre'` range un terrain sous l'un d'eux. Un titre n'a ni objectif ni date ; renommer ou supprimer un titre met à jour ou vide le champ des terrains concernés.

**Création rapide (2026-09-08)** : `data.draft = true` identifie une fiche à compléter, créée avec `pause = true` et des champs métier et dates vides. Ce marqueur reste dans le JSONB, les exports et le cache ; aucune colonne supplémentaire n’est nécessaire. Le chargement ne lui déduit ni début depuis `createdAt`, ni mandat, ni date de fin de SAS. L’édition partielle reste autorisée en pause ; les valeurs déjà renseignées sont validées. « Reprendre » exige les règles habituelles et un début explicite, puis passe `draft` et `pause` à `false`. Les RPC v3 conservent ce marqueur et les chaînes vides avec la même protection contre les conflits que les autres champs.


**SAS daté** (migration `20260904030000_sas_until.sql`) : `data->>'sasUntil'` = fin du test. Règle de déduction quand elle manque (app et SQL, fonction `sas_until_deduit`) : date explicite « (30/09) » dans le texte du SAS, sinon « 14 jours » / « 2 semaines » / « 1 mois » depuis le début, sinon 14 jours. L'échéance effective d'un mini-cosmos (`echeanceEffective` dans `cosmos-core.js`) est cette date tant que le SAS n'est pas franchi, puis la clôture.

Normaliser un jour les étapes et l’historique en tables reste une migration SQL pure à partir de `data`, sans changer le format d’échange de l’app.

**Journal restreint (2026-09-06)** : seuls les événements de type `modification` dont `changes` contient un changement réel du champ `Valeur actuelle` sont conservés. Le trigger `journal_valeur_actuelle_uniquement` filtre INSERT et UPDATE, enlève les autres champs d’un événement mixte et normalise son détail. Il ignore les entrées non admises sans annuler la sauvegarde du mini-cosmos. `agent_modifier` journalise uniquement `actuel` lorsqu’il change ; `agent_proposer` conserve la proposition sans événement ; `agent_noter` renvoie une erreur explicite. Les exemples et les anciennes données ne régénèrent pas le Journal depuis `history[]`.


### Groupes des étages (2026-09-07)

`cosmos_sections` contient `user_id`, `id` (identifiant stable), `name` (1–60 caractères), `etage` (ethos/logos/pathos), `position` et `created_at`. La clé primaire `(user_id,id)`, l’unicité du nom dans l’étage et les politiques RLS isolent chaque compte. `cosmos.section_id` est facultatif ; sa clé étrangère inclut le propriétaire. Un déclencheur vérifie la cohérence de l’étage. Supprimer un groupe libère ses cosmos, sans cascade vers les mini-cosmos. Changer l’étage d’un cosmos depuis un ancien client le retire de son ancien groupe.

`charger_etat_v3()` complète l’état existant avec `sections: [{id,name,etage}]` et `sectionDe: {nomCosmos: idSection}`. `sync_etat_v3()` ajoute `p_sections` et `p_section_de`, compare les versions attendues sous verrou et sauvegarde la structure dans la même transaction que les autres données. Les RPC précédentes restent disponibles. Les sections sont à un seul niveau ; le repli est un réglage local. Aucun événement de Journal n’est produit par cette organisation.

### Titres des espaces

`cosmos_titres_etages` contient `(user_id, etage)` et `titre` (1–300 caractères). Les trois identifiants restent fixes ; seul le libellé change. Les titres sont séparés des repères de la table `etages`, protégés par RLS et absents du Journal.

`charger_etat_v4()` ajoute `titresEtages: {ethos?: string, logos?: string, pathos?: string}`. `sync_etat_v4()` ajoute `p_titres_etages` (carte complète, `null` = inchangée, `{}` = titres par défaut). Elle vérifie `p_expected.titresEtages` sous verrou, puis sauvegarde dans la même transaction que la v3. Les RPC v3 restent compatibles et ne modifient jamais les titres. La migration `20260911013857_titres_etages.sql` doit précéder la mise en ligne du client v4.

La migration `20260911025128_titres_etages_300_caracteres.sql` porte la limite à 300 caractères dans la contrainte de table et la RPC v4, sans réécrire les titres existants.
