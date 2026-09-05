-- Trois étages fixes, dans l'ordre de chute : Ethos (ce qui porte l'opérateur), Logos (ce qu'il fait tourner), Pathos (ce pour quoi tout existe).
-- Chaque cosmos appartient à un étage ; le domino se lit à l'intérieur de chaque étage. Chaque étage porte un repère, une phrase éditable sous son titre.
alter table public.cosmos add column if not exists etage text not null default 'logos'
  check (etage in ('ethos','logos','pathos'));

create table if not exists public.etages (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  etage   text not null check (etage in ('ethos','logos','pathos')),
  repere  text not null default '',
  primary key (user_id, etage)
);
alter table public.etages enable row level security;
drop policy if exists etages_own on public.etages;
create policy etages_own on public.etages for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- répartition de départ, à ajuster en glissant dans l'app ; tout le reste reste en Logos
update public.cosmos set etage = 'ethos'  where name in ('SANTÉ', 'SANTÉ MENTAL', 'BIEN ÊTRE', 'PERSONNEL');
update public.cosmos set etage = 'pathos' where name in ('FAMILLE', 'RELATIONS', 'LOISIR');

-- charger_etat : + etageDe { cosmos : étage } et etages { étage : repère non vide }
create or replace function public.charger_etat() returns jsonb
language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = auth.uid()), '[]'::jsonb),
    'reperes', coalesce((select jsonb_object_agg(name, repere) from cosmos where user_id = auth.uid() and repere <> ''), '{}'::jsonb),
    'etageDe', coalesce((select jsonb_object_agg(name, etage) from cosmos where user_id = auth.uid()), '{}'::jsonb),
    'etages', coalesce((select jsonb_object_agg(etage, repere) from etages where user_id = auth.uid() and repere <> ''), '{}'::jsonb),
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

-- sync_etat : nouvelle signature (+ p_etage_de, p_etages) — l'ancienne est retirée pour éviter toute ambiguïté côté API
drop function public.sync_etat(text[], jsonb, text[], jsonb, boolean, text, jsonb, jsonb);
create function public.sync_etat(
  p_cosmos    text[]  default null,
  p_rows      jsonb   default '[]'::jsonb,
  p_deleted   text[]  default '{}'::text[],
  p_journal   jsonb   default '[]'::jsonb,
  p_replace   boolean default false,
  p_author    text    default 'Toi',
  p_lentilles jsonb   default null,
  p_reperes   jsonb   default null,
  p_etage_de  jsonb   default null,
  p_etages    jsonb   default null
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
    delete from etages       where user_id = uid;
  end if;
  if p_cosmos is not null then
    delete from cosmos where user_id = uid and not (name = any(p_cosmos));
    for i in 1 .. coalesce(array_length(p_cosmos, 1), 0) loop
      insert into cosmos (user_id, name, position) values (uid, p_cosmos[i], i - 1)
      on conflict (user_id, name) do update set position = excluded.position;
    end loop;
  end if;
  -- repères : la carte complète est envoyée quand elle change ; un cosmos absent de la carte n'a pas de repère
  if p_reperes is not null then
    update cosmos c set repere = left(coalesce(p_reperes->>c.name, ''), 120) where c.user_id = uid;
  end if;
  -- étages : carte complète { cosmos : étage } ; une valeur inconnue laisse l'étage en place
  if p_etage_de is not null then
    update cosmos c set etage = p_etage_de->>c.name
     where c.user_id = uid and (p_etage_de->>c.name) in ('ethos', 'logos', 'pathos');
  end if;
  -- repères d'étage : carte complète { étage : texte } ; un texte vide efface
  if p_etages is not null then
    delete from etages where user_id = uid;
    insert into etages (user_id, etage, repere)
    select uid, e.k, left(e.v, 160) from jsonb_each_text(p_etages) as e(k, v)
     where e.k in ('ethos', 'logos', 'pathos') and coalesce(trim(e.v), '') <> '';
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

-- agents : « lire » renvoie aussi l'étage de chaque cosmos et les repères d'étage — en lecture seule
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
    'reperes', coalesce((select jsonb_object_agg(name, repere) from cosmos where user_id = a.user_id and repere <> ''), '{}'::jsonb),
    'etageDe', coalesce((select jsonb_object_agg(name, etage) from cosmos where user_id = a.user_id), '{}'::jsonb),
    'etages', coalesce((select jsonb_object_agg(etage, repere) from etages where user_id = a.user_id and repere <> ''), '{}'::jsonb),
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
