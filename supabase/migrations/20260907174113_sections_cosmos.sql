-- Un niveau de séparations à l'intérieur des trois étages. Aucun déplacement initial.
create table public.cosmos_sections (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  name text not null check (name = btrim(name) and length(name) between 1 and 60),
  name_key text generated always as (lower(name)) stored,
  etage text not null check (etage in ('ethos','logos','pathos')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id,id),
  constraint cosmos_sections_name_unique unique (user_id,etage,name_key) deferrable initially deferred
);
alter table public.cosmos_sections enable row level security;
create policy sections_owner on public.cosmos_sections to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.cosmos_sections from anon;
grant select,insert,update,delete on public.cosmos_sections to authenticated;
grant all on public.cosmos_sections to service_role;
alter table public.cosmos add column section_id text;
alter table public.cosmos add constraint cosmos_section_owner_fk foreign key (user_id,section_id)
  references public.cosmos_sections(user_id,id);
create index cosmos_section_idx on public.cosmos(user_id,section_id) where section_id is not null;

-- La suppression d'une séparation libère seulement ses cosmos.
create function public.cosmos_section_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.cosmos set section_id=null where user_id=old.user_id and section_id=old.id;
    return old;
  end if;
  if (new.user_id,new.id,new.etage) is distinct from (old.user_id,old.id,old.etage) then
    raise exception 'L’identité et l’étage d’une séparation sont fixes.';
  end if;
  return new;
end $$;
create trigger cosmos_section_guard before update or delete on public.cosmos_sections
  for each row execute function public.cosmos_section_guard();
create function public.cosmos_membership_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.cosmos_sections where user_id=new.user_id and id=new.section_id and etage=new.etage
  ) then
    -- Un ancien onglet peut encore déplacer un cosmos entre étages sans connaître les sections.
    if tg_op='UPDATE' and new.etage is distinct from old.etage and new.section_id is not distinct from old.section_id then
      new.section_id := null;
    else raise exception 'La séparation doit appartenir au même compte et au même étage que le cosmos.';
    end if;
  end if;
  return new;
end $$;
create trigger cosmos_membership_guard before insert or update of user_id,etage,section_id on public.cosmos
  for each row execute function public.cosmos_membership_guard();
revoke all on function public.cosmos_section_guard(), public.cosmos_membership_guard() from public,anon,authenticated;

create function public.charger_etat_v3() returns jsonb
language sql security invoker set search_path = public as $$
  select public.charger_etat() || jsonb_build_object(
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'etage',etage) order by position,id)
      from public.cosmos_sections where user_id=(select auth.uid())),'[]'::jsonb),
    'sectionDe',coalesce((select jsonb_object_agg(name,section_id) from public.cosmos
      where user_id=(select auth.uid()) and section_id is not null),'{}'::jsonb)
  );
$$;

-- Les anciennes RPC restent compatibles. La v3 protège aussi les définitions et appartenances.
create function public.sync_etat_v3(
  p_cosmos text[] default null, p_rows jsonb default '[]'::jsonb,
  p_deleted text[] default '{}'::text[], p_journal jsonb default '[]'::jsonb,
  p_replace boolean default false, p_author text default 'Toi',
  p_etage_de jsonb default null, p_etages jsonb default null,
  p_titres_de jsonb default null, p_expected jsonb default '{}'::jsonb,
  p_sections jsonb default null, p_section_de jsonb default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid(); current_sections jsonb; current_membership jsonb;
  result jsonb; snapshot jsonb;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_sections is not null and jsonb_typeof(p_sections)<>'array' then raise exception 'Séparations invalides.'; end if;
  if p_section_de is not null and jsonb_typeof(p_section_de)<>'object' then raise exception 'Rangement invalide.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  perform 1 from public.cosmos where user_id=uid order by name for update;
  perform 1 from public.cosmos_sections where user_id=uid order by id for update;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'etage',etage) order by position,id),'[]')
    into current_sections from public.cosmos_sections where user_id=uid;
  select coalesce(jsonb_object_agg(name,section_id),'{}') into current_membership
    from public.cosmos where user_id=uid and section_id is not null;
  if not p_replace and (p_sections is not null or p_section_de is not null) then
    if (current_sections is distinct from coalesce(p_expected->'sections','[]'::jsonb)
        and current_sections is distinct from p_sections)
       or (current_membership is distinct from coalesce(p_expected->'sectionDe','{}'::jsonb)
        and current_membership is distinct from p_section_de) then
      raise exception using errcode='P4090', message='Les séparations ou le rangement ont été modifiés sur un autre appareil.';
    end if;
  end if;
  result := public.sync_etat_v2(p_cosmos,p_rows,p_deleted,p_journal,p_replace,p_author,p_etage_de,p_etages,p_titres_de,p_expected);
  if p_replace then delete from public.cosmos_sections where user_id=uid;
  elsif p_sections is not null then
    delete from public.cosmos_sections where user_id=uid and id not in (select x->>'id' from jsonb_array_elements(p_sections) x);
  end if;
  if p_sections is not null then
    insert into public.cosmos_sections(user_id,id,name,etage,position)
      select uid,x->>'id',x->>'name',x->>'etage',(ord-1)::integer from jsonb_array_elements(p_sections) with ordinality a(x,ord)
      on conflict (user_id,id) do update set name=excluded.name,etage=excluded.etage,position=excluded.position;
  end if;
  if p_section_de is not null then
    if exists (
      select 1 from jsonb_each_text(p_section_de) m
      left join public.cosmos c on c.user_id=uid and c.name=m.key
      left join public.cosmos_sections s on s.user_id=uid and s.id=m.value and s.etage=c.etage
      where c.name is null or s.id is null
    ) then raise exception 'Rangement invalide : cosmos et séparation doivent appartenir au même étage.'; end if;
    update public.cosmos set section_id=p_section_de->>name
      where user_id=uid and section_id is distinct from p_section_de->>name;
  end if;
  select jsonb_build_object(
    'sections',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'etage',etage) order by position,id)
      from public.cosmos_sections where user_id=uid),'[]'::jsonb),
    'sectionDe',coalesce((select jsonb_object_agg(name,section_id) from public.cosmos where user_id=uid and section_id is not null),'{}'::jsonb)
  ) into snapshot;
  return result || jsonb_build_object('structure',(result->'structure') || snapshot);
end $$;
revoke all on function public.charger_etat_v3(), public.sync_etat_v3(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.charger_etat_v3(), public.sync_etat_v3(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
