# Cosmos — schéma de données

Modèle figé au 2026-09-04. Le JSON exporté par l'application (`version: 1`) suit ce modèle : `cosmos[]` → table `cosmos`, `miniCosmos[]` → tables `mini_cosmos` + `etapes` + `evenements` (historique), `journal[]` + `journalArchive[]` → table `journal`.

## Concepts (rappel)
- **Cosmos** : grand domaine de vie (pièce). **Mini-cosmos** : terrain gouverné à l'intérieur (meuble).
- **Statut** — calculé, sauf deux drapeaux manuels : `Clôturé` (closed) > `Pause` (pause manuelle, ou date de début future) > `SAS` (champ SAS rempli et non franchi) > `Actif`.
- **Échéance** — soit une date (précise, fin de mois, fin de trimestre, fin d'année), soit `Permanent` (objectif continu). Remplace l'ancien « type d'objectif ».
- **Projection** — calculée : avancement dans le temps entre début et échéance ; zone `ok | tension | jourj | retard | continu | termine`, la tension démarrant `alert_days` jours avant l'échéance.
- **SAS** — test d'entrée borné ; c'est la première étape du mini-cosmos tant qu'il n'est pas franchi.

## Entités

**cosmos**
- `id` uuid PK · `name` text unique (majuscules) · `position` int · `created_at` timestamptz

**mini_cosmos**
- `id` uuid PK · `cosmos_id` uuid FK → cosmos (cascade)
- `name` text
- `objectif`, `valeur_actuelle`, `entropie`, `reponse_entropie` text — entropie et réponse obligatoires à la création
- `seuil_alerte`, `seuil_kill` text (libre)
- `sas` text nullable · `sas_done` bool default false
- `pause` bool default false · `closed` bool default false
- `start_at` date — date de début (défaut : création) ; future ⇒ Pause automatique
- `cloture_kind` enum `date | month | quarter | year | permanent`
- `cloture_value` text nullable — `AAAA-MM-JJ` · `AAAA-MM` · `AAAA-Qn` · `AAAA` · null si permanent
- `alert_days` int default 7 — préavis de tension
- `position` int · `created_at`, `updated_at` timestamptz

**etapes**
- `id` uuid PK · `mini_cosmos_id` FK (cascade) · `texte` text · `done` bool · `done_at` timestamptz nullable · `position` int

**evenements** — historique compact par mini-cosmos (alimente les statistiques)
- `id` uuid PK · `mini_cosmos_id` FK (cascade) · `type` enum `created | statut | step` · `valeur` text nullable · `created_at` timestamptz

**journal** — trace complète de toute écriture (humain ou agent IA)
- `id` uuid PK · `created_at` timestamptz · `author` text
- `type` enum `creation | statut | etape | modification | deplacement | suppression | cosmos | donnees`
- `mini_cosmos_id` uuid nullable (FK sans cascade : la trace survit à la suppression) · `mini_nom`, `cosmos_nom` text (dénormalisés pour la lecture)
- `detail` text · `changes` jsonb nullable — `[{field, before, after}]` pour les modifications
- Politique : 12 mois « vivants » en local, le reste archivé (table identique ou partition)

## Règles calculées (non stockées)
- `statut` (voir ci-dessus) · `cloture_resolue` = dernier jour du mois / trimestre / année, ou la date
- Ordre d'affichage : statut (Actif → SAS → Pause → Clôturé) puis `position` ; drag & drop uniquement au sein d'un même statut
- Projection : `pct = (today − start_at) / (cloture − start_at)` borné 0–100 ; `days = cloture − today` ; zone selon `alert_days`
- Compteur d'étapes = done / total (le SAS n'y compte pas)

## SQL (PostgreSQL)

```sql
create type cloture_kind as enum ('date','month','quarter','year','permanent');
create type ev_type      as enum ('created','statut','step');
create type journal_type as enum ('creation','statut','etape','modification','deplacement','suppression','cosmos','donnees');

create table cosmos (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table mini_cosmos (
  id uuid primary key default gen_random_uuid(),
  cosmos_id uuid not null references cosmos(id) on delete cascade,
  name text not null,
  objectif text, valeur_actuelle text,
  entropie text not null, reponse_entropie text not null,
  seuil_alerte text, seuil_kill text,
  sas text, sas_done boolean not null default false,
  pause boolean not null default false,
  closed boolean not null default false,
  start_at date not null default current_date,
  cloture_kind cloture_kind not null default 'date',
  cloture_value text,
  alert_days int not null default 7 check (alert_days >= 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cloture_value_shape check (
    (cloture_kind = 'permanent' and cloture_value is null) or
    (cloture_kind = 'date'    and cloture_value ~ '^\d{4}-\d{2}-\d{2}$') or
    (cloture_kind = 'month'   and cloture_value ~ '^\d{4}-\d{2}$') or
    (cloture_kind = 'quarter' and cloture_value ~ '^\d{4}-Q[1-4]$') or
    (cloture_kind = 'year'    and cloture_value ~ '^\d{4}$')),
  constraint unique_name_per_cosmos unique (cosmos_id, name)
);
create index on mini_cosmos (cosmos_id, position);

create table etapes (
  id uuid primary key default gen_random_uuid(),
  mini_cosmos_id uuid not null references mini_cosmos(id) on delete cascade,
  texte text not null,
  done boolean not null default false,
  done_at timestamptz,
  position int not null default 0
);
create index on etapes (mini_cosmos_id, position);

create table evenements (
  id uuid primary key default gen_random_uuid(),
  mini_cosmos_id uuid not null references mini_cosmos(id) on delete cascade,
  type ev_type not null,
  valeur text,
  created_at timestamptz not null default now()
);
create index on evenements (created_at);

create table journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  author text not null,
  type journal_type not null,
  mini_cosmos_id uuid references mini_cosmos(id) on delete set null,
  mini_nom text, cosmos_nom text,
  detail text,
  changes jsonb
);
create index on journal (created_at desc);
create index on journal (mini_cosmos_id);
```

SQLite : `enum` → `text` + `check (col in (...))`, `uuid` → `text`, `timestamptz` → `text` ISO 8601, `jsonb` → `text`, regex → à valider côté application.

## Correspondance avec l'export JSON

| JSON `miniCosmos[i]` | Colonne |
|---|---|
| `cosmos` (nom) | `cosmos_id` via `cosmos.name` |
| `actuel`, `reponse` | `valeur_actuelle`, `reponse_entropie` |
| `alerte`, `kill` | `seuil_alerte`, `seuil_kill` |
| `sas` (`—` ⇒ null), `sasDone` | `sas`, `sas_done` |
| `pause`, `closed` | idem |
| `startAt` (absent ⇒ `createdAt`) | `start_at` |
| `cloture` : `AAAA-MM-JJ` / `M:AAAA-MM` / `Q:AAAA-Qn` / `Y:AAAA` / `Permanent` | `cloture_kind` + `cloture_value` |
| `alertDays` (absent ⇒ 7) | `alert_days` |
| `actions[]` `{text, done}` | `etapes` (position = index) |
| `history[]` `{t, type, value}` | `evenements` |
| index dans le tableau | `position` |
| `journal[]`, `journalArchive[]` `{id, t, author, type, mini, miniId, cosmos, detail, changes}` | `journal` |

Champs hérités à ignorer à l'import : `statut` (recalculé), `etat`, `type`, `maintenance`.
