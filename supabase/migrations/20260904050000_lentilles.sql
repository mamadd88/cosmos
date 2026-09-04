-- Lentilles (tags) : ce qu'un mini-cosmos touche, à travers les cosmos. Un cosmos est là où une chose habite ;
-- une lentille est un fil qui traverse les pièces (santé, une personne, l'argent…).
-- Registre par utilisateur (nom, couleur, ordre) ; sur chaque mini-cosmos, data->'tags' = liste de noms.

create table public.lentilles (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#a1a1aa',
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, name)
);
alter table public.lentilles enable row level security;
create policy lentilles_own on public.lentilles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.charger_etat() returns jsonb
language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = auth.uid()), '[]'::jsonb),
    'lentilles', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'color', color, 'position', position) order by position, name)
                           from lentilles where user_id = auth.uid()), '[]'::jsonb),
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

-- nouvelle signature (p_lentilles) : on retire l'ancienne pour éviter toute ambiguïté côté API
drop function public.sync_etat(text[], jsonb, text[], jsonb, boolean, text);
create function public.sync_etat(
  p_cosmos    text[]  default null,
  p_rows      jsonb   default '[]'::jsonb,
  p_deleted   text[]  default '{}'::text[],
  p_journal   jsonb   default '[]'::jsonb,
  p_replace   boolean default false,
  p_author    text    default 'Toi',
  p_lentilles jsonb   default null
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
    delete from lentilles    where user_id = uid;
  end if;
  if p_cosmos is not null then
    delete from cosmos where user_id = uid and not (name = any(p_cosmos));
    for i in 1 .. coalesce(array_length(p_cosmos, 1), 0) loop
      insert into cosmos (user_id, name, position) values (uid, p_cosmos[i], i - 1)
      on conflict (user_id, name) do update set position = excluded.position;
    end loop;
  end if;
  if p_lentilles is not null then
    delete from lentilles where user_id = uid
       and name not in (select l->>'name' from jsonb_array_elements(p_lentilles) l where l->>'name' is not null);
    insert into lentilles (user_id, name, color, position)
    select uid, l->>'name', coalesce(l->>'color', '#a1a1aa'), coalesce((l->>'position')::int, 0)
      from jsonb_array_elements(p_lentilles) l where coalesce(trim(l->>'name'), '') <> ''
    on conflict (user_id, name) do update set color = excluded.color, position = excluded.position;
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into mini_cosmos (id, user_id, data, position, updated_at, updated_by)
    values (r->>'id', uid, r->'data', coalesce((r->>'position')::int, 0), ts, p_author)
    on conflict (user_id, id) do update
      set data = excluded.data, position = excluded.position, updated_at = ts, updated_by = p_author;
  end loop;
  if coalesce(array_length(p_deleted, 1), 0) > 0 then
    delete from mini_cosmos where user_id = uid and id = any(p_deleted);
  end if;
  insert into journal (id, user_id, t, author, type, mini_id, mini, cosmos, detail, changes)
  select j->>'id', uid, coalesce((j->>'t')::timestamptz, ts), coalesce(j->>'author', p_author), j->>'type',
         j->>'miniId', j->>'mini', j->>'cosmos', j->>'detail', j->'changes'
  from jsonb_array_elements(p_journal) as j
  on conflict (user_id, id) do nothing;
  return jsonb_build_object('savedAt', ts);
end $$;

-- agents : lecture des lentilles, patch « tags » (lentilles existantes uniquement)
create or replace function public.agent_lire(p_agent_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a agents%rowtype;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object(
    'agent', jsonb_build_object('nom', a.name, 'ecritureDirecte', a.ecriture_directe),
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = a.user_id), '[]'::jsonb),
    'lentilles', coalesce((select jsonb_agg(name order by position, name) from lentilles where user_id = a.user_id), '[]'::jsonb),
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

create or replace function public.agent_champ_libelle(k text) returns text language sql immutable as $$
  select case k when 'objectif' then 'Objectif' when 'actuel' then 'Valeur actuelle' when 'entropie' then 'Entropie'
                when 'reponse' then 'Réponse entropie' when 'sas' then 'SAS' when 'sasUntil' then 'Fin du test'
                when 'alerte' then 'Alerte' when 'kill' then 'Kill' when 'etapes' then 'Étapes' when 'tags' then 'Lentilles' else k end;
$$;

create or replace function public.agent_valider_patch(p_patch jsonb) returns void language plpgsql immutable as $$
declare bad text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'patch vide : objet attendu avec au moins un champ';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
   where k not in ('objectif','actuel','entropie','reponse','sas','sasUntil','alerte','kill','etapes','tags');
  if bad is not null then
    raise exception 'champs non autorisés : % (autorisés : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes, tags)', bad;
  end if;
  if p_patch ? 'etapes' and jsonb_typeof(p_patch->'etapes') <> 'array' then raise exception 'etapes doit être une liste de textes'; end if;
  if p_patch ? 'tags' and jsonb_typeof(p_patch->'tags') <> 'array' then raise exception 'tags doit être une liste de noms de lentilles existantes'; end if;
  if p_patch ? 'sasUntil' and (jsonb_typeof(p_patch->'sasUntil') <> 'string' or (p_patch->>'sasUntil') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'sasUntil doit être une date AAAA-MM-JJ (fin du test)';
  end if;
end $$;

create or replace function public.agent_modifier(p_agent_id uuid, p_mini_id text, p_patch jsonb, p_detail text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a agents%rowtype; m mini_cosmos%rowtype;
  newdata jsonb; etapes jsonb; k text; bad text; changes jsonb := '[]'::jsonb;
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
    elsif k = 'tags' then
      select string_agg(t, ', ') into bad from jsonb_array_elements_text(p_patch->'tags') t
       where not exists (select 1 from lentilles l where l.user_id = a.user_id and l.name = t);
      if bad is not null then raise exception 'lentilles inconnues : % (crée-les d''abord dans l''app)', bad; end if;
      changes := changes || jsonb_build_object('field', 'Lentilles',
                   'before', coalesce((select string_agg(t, ', ') from jsonb_array_elements_text(case when jsonb_typeof(m.data->'tags') = 'array' then m.data->'tags' else '[]'::jsonb end) t), ''),
                   'after',  coalesce((select string_agg(t, ', ') from jsonb_array_elements_text(p_patch->'tags') t), ''));
      newdata := jsonb_set(newdata, '{tags}', p_patch->'tags');
    else
      if jsonb_typeof(p_patch->k) <> 'string' then raise exception 'le champ % doit être un texte', k; end if;
      changes := changes || jsonb_build_object('field', agent_champ_libelle(k), 'before', coalesce(m.data->>k, ''), 'after', p_patch->>k);
      newdata := jsonb_set(newdata, array[k], p_patch->k);
    end if;
  end loop;
  update mini_cosmos set data = newdata, updated_at = now(), updated_by = a.name where id = m.id and user_id = m.user_id;
  insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail, changes)
  values ('a-' || replace(gen_random_uuid()::text, '-', ''), a.user_id, a.name, 'modification', m.id, m.name, m.cosmos,
          coalesce(nullif(trim(p_detail), ''), 'Modification par l''agent : ' ||
            (select string_agg(x->>'field', ', ') from jsonb_array_elements(changes) x)), changes);
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('id', m.id, 'data', newdata);
end $$;
