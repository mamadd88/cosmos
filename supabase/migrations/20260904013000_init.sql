-- Cosmos — schéma initial · Supabase (PostgreSQL 17)
--
-- Principes
--  · Mono-utilisateur : chaque ligne porte user_id ; la RLS garantit que chacun ne voit que ses lignes.
--  · mini_cosmos.data = l'objet complet de l'app (même format que l'export JSON, cf. schema.md) ;
--    des colonnes générées exposent les champs principaux en SQL (agents, statistiques, Studio).
--  · Agents IA : jamais la clé service_role. Ils passent par /api/agent (clé par agent, dont seule
--    l'empreinte SHA-256 est stockée ici) qui appelle les fonctions agent_* — exécutables uniquement
--    par service_role. Deux niveaux : proposer (défaut, validé par clic) et modifier (écriture directe).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- 1. cosmos : grands domaines de vie
-- ---------------------------------------------------------------------------------------------
create table public.cosmos (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);

-- ---------------------------------------------------------------------------------------------
-- 2. mini_cosmos : une ligne par mini-cosmos, l'objet complet dans `data`
-- ---------------------------------------------------------------------------------------------
create table public.mini_cosmos (
  id         text primary key,                                   -- identifiant de l'app ('mc-…')
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  position   int  not null default 0,
  cosmos           text    generated always as (data->>'cosmos') stored,
  name             text    generated always as (data->>'name') stored,
  objectif         text    generated always as (data->>'objectif') stored,
  valeur_actuelle  text    generated always as (data->>'actuel') stored,
  entropie         text    generated always as (data->>'entropie') stored,
  reponse_entropie text    generated always as (data->>'reponse') stored,
  seuil_alerte     text    generated always as (data->>'alerte') stored,
  seuil_kill       text    generated always as (data->>'kill') stored,
  sas              text    generated always as (data->>'sas') stored,
  sas_done         boolean generated always as (coalesce(data->'sasDone' = 'true'::jsonb, false)) stored,
  pause            boolean generated always as (coalesce(data->'pause'   = 'true'::jsonb, false)) stored,
  closed           boolean generated always as (coalesce(data->'closed'  = 'true'::jsonb, false)) stored,
  start_at         text    generated always as (data->>'startAt') stored,
  cloture          text    generated always as (data->>'cloture') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'Toi'
);
create index mini_cosmos_user_position on public.mini_cosmos (user_id, position);
create index mini_cosmos_user_updated  on public.mini_cosmos (user_id, updated_at);

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger mini_cosmos_touch before update on public.mini_cosmos
  for each row execute function public.touch_updated_at();

-- 3. etapes : vue en lecture qui déplie data->'actions' (le SAS n'y figure pas)
create view public.etapes with (security_invoker = true) as
  select m.user_id, m.id as mini_cosmos_id, m.name as mini_cosmos, (a.n - 1)::int as position,
         a.value->>'text' as texte, coalesce(a.value->'done' = 'true'::jsonb, false) as done
  from public.mini_cosmos m
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(m.data->'actions') = 'array' then m.data->'actions' else '[]'::jsonb end
  ) with ordinality as a(value, n);

-- ---------------------------------------------------------------------------------------------
-- 4. journal : trace de toute écriture (humain ou agent). Pas de FK : la trace survit à la suppression.
-- ---------------------------------------------------------------------------------------------
create table public.journal (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  t          timestamptz not null default now(),                 -- horodatage posé par l'auteur (affiché)
  created_at timestamptz not null default now(),                 -- horodatage serveur (synchronisation)
  author     text not null default 'Toi',
  type       text not null check (type in ('creation','statut','etape','modification','deplacement',
                                           'suppression','cosmos','donnees','proposition','note')),
  mini_id    text,
  mini       text,
  cosmos     text,
  detail     text,
  changes    jsonb                                               -- [{field, before, after}]
);
create index journal_user_t       on public.journal (user_id, t desc);
create index journal_user_created on public.journal (user_id, created_at);
create index journal_mini         on public.journal (mini_id);

-- ---------------------------------------------------------------------------------------------
-- 5. agents : une clé par agent (jamais stockée en clair)
-- ---------------------------------------------------------------------------------------------
create table public.agents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  key_hash         text not null unique,
  ecriture_directe boolean not null default false,               -- niveau 2 : modifier sans validation
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  last_used_at     timestamptz,
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------------------------
-- 6. propositions : ce qu'un agent suggère ; appliqué uniquement sur clic dans l'app
-- ---------------------------------------------------------------------------------------------
create table public.propositions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  agent_id   uuid references public.agents(id) on delete set null,
  agent_name text not null,
  mini_id    text not null references public.mini_cosmos(id) on delete cascade,
  patch      jsonb not null,     -- {objectif?, actuel?, entropie?, reponse?, sas?, alerte?, kill?, etapes?: [texte…]}
  motif      text,
  statut     text not null default 'en_attente' check (statut in ('en_attente','acceptee','refusee')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index propositions_user_statut on public.propositions (user_id, statut);

-- ---------------------------------------------------------------------------------------------
-- RLS : chacun ne voit et ne modifie que ses lignes ; anon n'a aucun accès
-- ---------------------------------------------------------------------------------------------
alter table public.cosmos       enable row level security;
alter table public.mini_cosmos  enable row level security;
alter table public.journal      enable row level security;
alter table public.agents       enable row level security;
alter table public.propositions enable row level security;

create policy cosmos_own       on public.cosmos       for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy mini_cosmos_own  on public.mini_cosmos  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journal_own      on public.journal      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agents_own       on public.agents       for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy propositions_own on public.propositions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Fonctions côté app (exécutées avec les droits de l'utilisateur connecté)
-- ---------------------------------------------------------------------------------------------

-- Tout l'état en un appel : cosmos, mini-cosmos, journal vivant (12 mois), propositions en attente
create function public.charger_etat() returns jsonb
language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = auth.uid()), '[]'::jsonb),
    'miniCosmos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data, 'position', position,
                              'updated_at', updated_at, 'updated_by', updated_by) order by position, created_at)
                            from mini_cosmos where user_id = auth.uid()), '[]'::jsonb),
    'journal', coalesce((select jsonb_agg(jsonb_build_object('id', id, 't', t, 'author', author, 'type', type,
                           'miniId', mini_id, 'mini', mini, 'cosmos', cosmos, 'detail', detail, 'changes', changes) order by t desc)
                         from journal where user_id = auth.uid() and t >= now() - interval '12 months'), '[]'::jsonb),
    'journalArchived', (select count(*) from journal where user_id = auth.uid() and t < now() - interval '12 months'),
    'propositions', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'agent', agent_name, 'miniId', mini_id,
                                'patch', patch, 'motif', motif, 'createdAt', created_at) order by created_at)
                              from propositions where user_id = auth.uid() and statut = 'en_attente'), '[]'::jsonb),
    'now', now()
  );
$$;

-- Sauvegarde différentielle en une transaction : cosmos (liste complète ou null), lignes modifiées,
-- lignes supprimées, nouvelles entrées de journal. p_replace = tout remplacer (import, restauration).
create function public.sync_etat(
  p_cosmos  text[]  default null,
  p_rows    jsonb   default '[]'::jsonb,
  p_deleted text[]  default '{}'::text[],
  p_journal jsonb   default '[]'::jsonb,
  p_replace boolean default false,
  p_author  text    default 'Toi'
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  ts  timestamptz := now();
  r   jsonb;
  i   int;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_replace then
    delete from propositions where user_id = uid;
    delete from journal      where user_id = uid;
    delete from mini_cosmos  where user_id = uid;
    delete from cosmos       where user_id = uid;
  end if;
  if p_cosmos is not null then
    delete from cosmos where user_id = uid and not (name = any(p_cosmos));
    for i in 1 .. coalesce(array_length(p_cosmos, 1), 0) loop
      insert into cosmos (user_id, name, position) values (uid, p_cosmos[i], i - 1)
      on conflict (user_id, name) do update set position = excluded.position;
    end loop;
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into mini_cosmos (id, user_id, data, position, updated_at, updated_by)
    values (r->>'id', uid, r->'data', coalesce((r->>'position')::int, 0), ts, p_author)
    on conflict (id) do update
      set data = excluded.data, position = excluded.position, updated_at = ts, updated_by = p_author
      where mini_cosmos.user_id = uid;
  end loop;
  if coalesce(array_length(p_deleted, 1), 0) > 0 then
    delete from mini_cosmos where user_id = uid and id = any(p_deleted);
  end if;
  insert into journal (id, user_id, t, author, type, mini_id, mini, cosmos, detail, changes)
  select j->>'id', uid, coalesce((j->>'t')::timestamptz, ts), coalesce(j->>'author', p_author), j->>'type',
         j->>'miniId', j->>'mini', j->>'cosmos', j->>'detail', j->'changes'
  from jsonb_array_elements(p_journal) as j
  on conflict (id) do nothing;
  return jsonb_build_object('savedAt', ts);
end $$;

-- Crée un agent et renvoie sa clé, affichée une seule fois. p_user_id ne sert que depuis l'éditeur SQL
-- (où auth.uid() est null) ; un utilisateur connecté crée toujours pour lui-même.
create function public.creer_agent(p_name text, p_ecriture_directe boolean default false, p_user_id uuid default null)
returns text language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := coalesce(auth.uid(), p_user_id);
  k   text;
begin
  if uid is null then raise exception 'non authentifié (ou passe p_user_id depuis l''éditeur SQL)'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'nom d''agent requis'; end if;
  k := 'cosmos_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into agents (user_id, name, key_hash, ecriture_directe)
  values (uid, trim(p_name), encode(extensions.digest(k, 'sha256'), 'hex'), coalesce(p_ecriture_directe, false));
  return k;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Fonctions agents (security definer ; exécutables uniquement par service_role via /api/agent)
-- ---------------------------------------------------------------------------------------------

create function public.agent_verifier(p_key_hash text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'nom', name, 'ecritureDirecte', ecriture_directe)
  from agents where key_hash = p_key_hash and actif;
$$;

create function public.agent_lire(p_agent_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a agents%rowtype;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object(
    'agent', jsonb_build_object('nom', a.name, 'ecritureDirecte', a.ecriture_directe),
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = a.user_id), '[]'::jsonb),
    'miniCosmos', coalesce((select jsonb_agg(data || jsonb_build_object('id', id, 'updatedAt', updated_at, 'updatedBy', updated_by)
                                             order by position, created_at)
                            from mini_cosmos where user_id = a.user_id), '[]'::jsonb),
    'propositionsEnAttente', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'agent', agent_name, 'miniId', mini_id,
                                          'patch', patch, 'motif', motif, 'creeLe', created_at) order by created_at)
                                       from propositions where user_id = a.user_id and statut = 'en_attente'), '[]'::jsonb),
    'journalRecent', coalesce((select jsonb_agg(jsonb_build_object('t', t, 'auteur', author, 'type', type, 'mini', mini,
                                   'cosmos', cosmos, 'detail', detail) order by t desc)
                               from (select * from journal where user_id = a.user_id order by t desc limit 50) j), '[]'::jsonb)
  );
end $$;

-- Champs qu'un agent peut viser, et leur libellé dans le journal
create function public.agent_champ_libelle(k text) returns text language sql immutable as $$
  select case k when 'objectif' then 'Objectif' when 'actuel' then 'Valeur actuelle' when 'entropie' then 'Entropie'
                when 'reponse' then 'Réponse entropie' when 'sas' then 'SAS' when 'alerte' then 'Alerte'
                when 'kill' then 'Kill' when 'etapes' then 'Étapes' else k end;
$$;

create function public.agent_valider_patch(p_patch jsonb) returns void language plpgsql immutable as $$
declare bad text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'patch vide : objet attendu avec au moins un champ';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
   where k not in ('objectif','actuel','entropie','reponse','sas','alerte','kill','etapes');
  if bad is not null then
    raise exception 'champs non autorisés : % (autorisés : objectif, actuel, entropie, reponse, sas, alerte, kill, etapes)', bad;
  end if;
  if p_patch ? 'etapes' and jsonb_typeof(p_patch->'etapes') <> 'array' then
    raise exception 'etapes doit être une liste de textes';
  end if;
end $$;

-- Niveau 1 : proposer. Rien n'est modifié ; l'utilisateur accepte ou refuse dans l'app.
create function public.agent_proposer(p_agent_id uuid, p_mini_id text, p_patch jsonb, p_motif text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a agents%rowtype; m mini_cosmos%rowtype; pid uuid;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  select * into m from mini_cosmos where id = p_mini_id and user_id = a.user_id;
  if not found then raise exception 'mini-cosmos introuvable : %', p_mini_id; end if;
  perform agent_valider_patch(p_patch);
  insert into propositions (user_id, agent_id, agent_name, mini_id, patch, motif)
  values (a.user_id, a.id, a.name, m.id, p_patch, nullif(trim(p_motif), '')) returning id into pid;
  insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail)
  values ('p-' || replace(pid::text, '-', ''), a.user_id, a.name, 'proposition', m.id, m.name, m.cosmos,
          'Proposition : ' || (select string_agg(agent_champ_libelle(k), ', ') from jsonb_object_keys(p_patch) k)
          || coalesce(' — ' || nullif(trim(p_motif), ''), ''));
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('propositionId', pid, 'statut', 'en_attente');
end $$;

-- Niveau 2 : modifier directement (agents avec ecriture_directe). Toujours tracé dans le journal.
create function public.agent_modifier(p_agent_id uuid, p_mini_id text, p_patch jsonb, p_detail text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a agents%rowtype; m mini_cosmos%rowtype;
  newdata jsonb; etapes jsonb; k text; changes jsonb := '[]'::jsonb;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  if not a.ecriture_directe then
    raise exception 'cet agent n''a pas l''écriture directe : utilise l''action « proposer »';
  end if;
  select * into m from mini_cosmos where id = p_mini_id and user_id = a.user_id;
  if not found then raise exception 'mini-cosmos introuvable : %', p_mini_id; end if;
  perform agent_valider_patch(p_patch);
  newdata := m.data;
  for k in select jsonb_object_keys(p_patch) loop
    if k = 'etapes' then
      etapes := case when jsonb_typeof(m.data->'actions') = 'array' then m.data->'actions' else '[]'::jsonb end;
      select etapes || coalesce(jsonb_agg(jsonb_build_object('text', e, 'done', false)), '[]'::jsonb) into etapes
        from jsonb_array_elements_text(p_patch->'etapes') e
       where not exists (select 1 from jsonb_array_elements(etapes) x where x->>'text' = e);
      changes := changes || jsonb_build_object('field', 'Étapes',
                   'before', jsonb_array_length(case when jsonb_typeof(m.data->'actions') = 'array' then m.data->'actions' else '[]'::jsonb end)::text || ' étape(s)',
                   'after',  jsonb_array_length(etapes)::text || ' étape(s)');
      newdata := jsonb_set(newdata, '{actions}', etapes);
    else
      if jsonb_typeof(p_patch->k) <> 'string' then raise exception 'le champ % doit être un texte', k; end if;
      changes := changes || jsonb_build_object('field', agent_champ_libelle(k), 'before', coalesce(m.data->>k, ''), 'after', p_patch->>k);
      newdata := jsonb_set(newdata, array[k], p_patch->k);
    end if;
  end loop;
  update mini_cosmos set data = newdata, updated_at = now(), updated_by = a.name where id = m.id;
  insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail, changes)
  values ('a-' || replace(gen_random_uuid()::text, '-', ''), a.user_id, a.name, 'modification', m.id, m.name, m.cosmos,
          coalesce(nullif(trim(p_detail), ''), 'Modification par l''agent : ' ||
            (select string_agg(x->>'field', ', ') from jsonb_array_elements(changes) x)), changes);
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('id', m.id, 'data', newdata);
end $$;

-- Note dans le journal, sans rien modifier (observation, relevé, rappel)
create function public.agent_noter(p_agent_id uuid, p_detail text, p_mini_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a agents%rowtype; m mini_cosmos%rowtype; jid text;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  if coalesce(trim(p_detail), '') = '' then raise exception 'detail requis'; end if;
  if p_mini_id is not null then
    select * into m from mini_cosmos where id = p_mini_id and user_id = a.user_id;
    if not found then raise exception 'mini-cosmos introuvable : %', p_mini_id; end if;
  end if;
  jid := 'n-' || replace(gen_random_uuid()::text, '-', '');
  insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail)
  values (jid, a.user_id, a.name, 'note', m.id, m.name, m.cosmos, trim(p_detail));
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('journalId', jid);
end $$;

revoke execute on function public.agent_verifier(text) from public, anon, authenticated;
revoke execute on function public.agent_lire(uuid) from public, anon, authenticated;
revoke execute on function public.agent_proposer(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.agent_modifier(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.agent_noter(uuid, text, text) from public, anon, authenticated;
grant execute on function public.agent_verifier(text) to service_role;
grant execute on function public.agent_lire(uuid) to service_role;
grant execute on function public.agent_proposer(uuid, text, jsonb, text) to service_role;
grant execute on function public.agent_modifier(uuid, text, jsonb, text) to service_role;
grant execute on function public.agent_noter(uuid, text, text) to service_role;
