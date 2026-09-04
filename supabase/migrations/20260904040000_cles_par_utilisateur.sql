-- Les identifiants de l'app (mc-…, entrées de journal) sont uniques par utilisateur, pas globalement :
-- deux comptes qui partent du même exemple portent les mêmes ids. Clés primaires composées (user_id, id).

alter table public.propositions drop constraint propositions_mini_id_fkey;
alter table public.mini_cosmos  drop constraint mini_cosmos_pkey;
alter table public.mini_cosmos  add primary key (user_id, id);
alter table public.propositions add constraint propositions_mini_fkey
  foreign key (user_id, mini_id) references public.mini_cosmos (user_id, id) on delete cascade;

alter table public.journal drop constraint journal_pkey;
alter table public.journal add primary key (user_id, id);

create or replace function public.sync_etat(
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
