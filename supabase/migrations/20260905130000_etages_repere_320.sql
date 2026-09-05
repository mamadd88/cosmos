-- Le repère d'un étage peut faire jusqu'à 320 caractères (une citation tient rarement en 160).
create or replace function public.sync_etat(
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
