-- Retrait des lentilles : l'arborescence étages → pièces → titres suffit. La table disparaît, le champ data->'tags' est retiré des
-- mini-cosmos, les fonctions ne renvoient plus de lentilles et les agents ne peuvent plus écrire « tags ».

-- charger_etat sans 'lentilles'
create or replace function public.charger_etat() returns jsonb
language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'cosmos', coalesce((select jsonb_agg(name order by position, name) from cosmos where user_id = auth.uid()), '[]'::jsonb),
    'reperes', coalesce((select jsonb_object_agg(name, repere) from cosmos where user_id = auth.uid() and repere <> ''), '{}'::jsonb),
    'etageDe', coalesce((select jsonb_object_agg(name, etage) from cosmos where user_id = auth.uid()), '{}'::jsonb),
    'etages', coalesce((select jsonb_object_agg(etage, repere) from etages where user_id = auth.uid() and repere <> ''), '{}'::jsonb),
    'titresDe', coalesce((select jsonb_object_agg(name, titres) from cosmos where user_id = auth.uid() and titres <> '[]'::jsonb), '{}'::jsonb),
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

-- sync_etat sans p_lentilles : nouvelle signature, l'ancienne est retirée
drop function public.sync_etat(text[], jsonb, text[], jsonb, boolean, text, jsonb, jsonb, jsonb, jsonb, jsonb);
create function public.sync_etat(
  p_cosmos    text[]  default null,
  p_rows      jsonb   default '[]'::jsonb,
  p_deleted   text[]  default '{}'::text[],
  p_journal   jsonb   default '[]'::jsonb,
  p_replace   boolean default false,
  p_author    text    default 'Toi',
  p_reperes   jsonb   default null,
  p_etage_de  jsonb   default null,
  p_etages    jsonb   default null,
  p_titres_de jsonb   default null
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
    delete from etages       where user_id = uid;
  end if;
  if p_cosmos is not null then
    delete from cosmos where user_id = uid and not (name = any(p_cosmos));
    for i in 1 .. coalesce(array_length(p_cosmos, 1), 0) loop
      insert into cosmos (user_id, name, position) values (uid, p_cosmos[i], i - 1)
      on conflict (user_id, name) do update set position = excluded.position;
    end loop;
  end if;
  if p_reperes is not null then
    update cosmos c set repere = left(coalesce(p_reperes->>c.name, ''), 120) where c.user_id = uid;
  end if;
  if p_etage_de is not null then
    update cosmos c set etage = p_etage_de->>c.name
     where c.user_id = uid and (p_etage_de->>c.name) in ('ethos', 'logos', 'pathos');
  end if;
  if p_etages is not null then
    delete from etages where user_id = uid;
    insert into etages (user_id, etage, repere)
    select uid, e.k, left(e.v, 320) from jsonb_each_text(p_etages) as e(k, v)
     where e.k in ('ethos', 'logos', 'pathos') and coalesce(trim(e.v), '') <> '';
  end if;
  if p_titres_de is not null then
    update cosmos c set titres = case when jsonb_typeof(p_titres_de->c.name) = 'array' then p_titres_de->c.name else '[]'::jsonb end
     where c.user_id = uid;
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    insert into mini_cosmos (id, user_id, data, position, updated_at, updated_by)
    values (r->>'id', uid, (r->'data') - 'tags', coalesce((r->>'position')::int, 0), ts, p_author)
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

-- agents : plus de lentilles en lecture, plus de « tags » en écriture
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
    'titresDe', coalesce((select jsonb_object_agg(name, titres) from cosmos where user_id = a.user_id and titres <> '[]'::jsonb), '{}'::jsonb),
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
                when 'alerte' then 'Alerte' when 'kill' then 'Kill' when 'etapes' then 'Étapes'
                when 'poids' then 'Poids' else k end;
$$;

create or replace function public.agent_valider_patch(p_patch jsonb) returns void language plpgsql immutable as $$
declare bad text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'patch vide : objet attendu avec au moins un champ';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
   where k not in ('objectif','actuel','entropie','reponse','sas','sasUntil','alerte','kill','etapes','poids');
  if bad is not null then
    raise exception 'champs non autorisés : % (autorisés : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes, poids)', bad;
  end if;
  if p_patch ? 'etapes' and jsonb_typeof(p_patch->'etapes') <> 'array' then raise exception 'etapes doit être une liste de textes'; end if;
  if p_patch ? 'sasUntil' and (jsonb_typeof(p_patch->'sasUntil') <> 'string' or (p_patch->>'sasUntil') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'sasUntil doit être une date AAAA-MM-JJ (fin du test)';
  end if;
  if p_patch ? 'poids' and (jsonb_typeof(p_patch->'poids') <> 'string' or (p_patch->>'poids') not in ('vital','important','normal')) then
    raise exception 'poids doit valoir vital, important ou normal';
  end if;
end $$;

create or replace function public.agent_modifier(p_agent_id uuid, p_mini_id text, p_patch jsonb, p_detail text default null)
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
  update mini_cosmos set data = newdata, updated_at = now(), updated_by = a.name where id = m.id and user_id = m.user_id;
  insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail, changes)
  values ('a-' || replace(gen_random_uuid()::text, '-', ''), a.user_id, a.name, 'modification', m.id, m.name, m.cosmos,
          coalesce(nullif(trim(p_detail), ''), 'Modification par l''agent : ' ||
            (select string_agg(x->>'field', ', ') from jsonb_array_elements(changes) x)), changes);
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('id', m.id, 'data', newdata);
end $$;

-- données : le champ tags est retiré des mini-cosmos ; la table des lentilles disparaît
update public.mini_cosmos set data = data - 'tags' where data ? 'tags';
drop table if exists public.lentilles;
