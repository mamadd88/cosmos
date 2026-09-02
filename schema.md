# Cosmos — schéma de données

Modèle figé au 2026-09-02. Le JSON exporté par l'application (`version: 1`) suit ce modèle : `cosmos[]` → table `cosmos`, `miniCosmos[]` → tables `mini_cosmos` + `etapes` + `evenements`.

## Entités

**cosmos** — un grand domaine de vie (pièce).
- `id` uuid PK
- `name` text unique (majuscules)
- `position` int — ordre manuel (drag & drop)
- `created_at` timestamptz

**mini_cosmos** — un terrain gouverné dans un cosmos (meuble).
- `id` uuid PK
- `cosmos_id` uuid FK → cosmos (on delete cascade)
- `name` text
- `type` enum `conquete | maintenance`
- `objectif`, `valeur_actuelle`, `sas`, `entropie`, `reponse_entropie`, `force` text (libre)
- `seuil_alerte`, `seuil_kill` text (libre)
- `statut` enum `draft | actif | pause | cloture`
- `etat` enum `stable | derive | danger` nullable — **null obligatoire** si statut ∈ {draft, pause}
- `date_cloture` date nullable — **null obligatoire** si type = maintenance ; date cible en cours, date effective une fois clôturé
- `position` int — ordre manuel au sein d'un même statut
- `created_at`, `updated_at` timestamptz

**etapes** — les étapes d'un mini-cosmos ; la progression = done / total (conquête seulement).
- `id` uuid PK
- `mini_cosmos_id` uuid FK (cascade)
- `texte` text
- `done` bool, `done_at` timestamptz nullable
- `position` int

**evenements** — journal alimentant les statistiques.
- `id` uuid PK
- `mini_cosmos_id` uuid FK (cascade)
- `type` enum `created | statut | etat | step`
- `valeur` text nullable (nouveau statut / état)
- `created_at` timestamptz

**modeles** (optionnel, peut rester en dur dans l'app)
- `id`, `domaine` text, `nom` text, `type_suggere` enum nullable

## Règles calculées (non stockées)
- Ordre d'affichage : `statut` (actif → pause → draft → cloture) puis `position`.
- Progression, prochaine étape, compteur d'étapes : dérivés de `etapes`.
- « Clôture dans 7 j / 30 j », J-xx : dérivés de `date_cloture`.
- KPI et stats de période : dérivés de `evenements`.

## SQL (PostgreSQL)

```sql
create type mc_type   as enum ('conquete','maintenance');
create type mc_statut as enum ('draft','actif','pause','cloture');
create type mc_etat   as enum ('stable','derive','danger');
create type ev_type   as enum ('created','statut','etat','step');

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
  type mc_type not null default 'conquete',
  objectif text, valeur_actuelle text, sas text,
  entropie text, reponse_entropie text, force text,
  seuil_alerte text, seuil_kill text,
  statut mc_statut not null default 'draft',
  etat mc_etat,
  date_cloture date,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint etat_only_when_live check (statut in ('actif','cloture') or etat is null),
  constraint no_cloture_for_maintenance check (type = 'conquete' or date_cloture is null)
);
create index on mini_cosmos (cosmos_id, statut, position);

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
create index on evenements (mini_cosmos_id, type);
```

Pour SQLite : remplacer les `enum` par `text` + `check (col in (...))`, `uuid` par `text`, `timestamptz` par `text` (ISO 8601).

## Correspondance avec l'export JSON

| JSON (`miniCosmos[i]`) | Colonne |
|---|---|
| `cosmos` (nom) | `cosmos_id` via `cosmos.name` |
| `type` `Conquête`/`Maintenance` | `type` |
| `statut` `Draft`/`Actif`/`Pause`/`Clôturé` | `statut` |
| `etat` `stable`/`derive`/`danger` | `etat` (mettre null si draft/pause) |
| `actuel`, `maintenance`, `reponse` | `valeur_actuelle`, `force`, `reponse_entropie` |
| `alerte`, `kill` | `seuil_alerte`, `seuil_kill` |
| `cloture` ISO ou `Permanent` | `date_cloture` (`Permanent` → null) |
| `actions[]` `{text, done}` | `etapes` (position = index) |
| `history[]` `{t, type, value}` | `evenements` |
| index dans le tableau | `position` |
