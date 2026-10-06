-- Titres personnalisables, séparés des anciens repères d'étage : une v3 ne peut pas les effacer.
create table public.cosmos_titres_etages (
  user_id uuid not null references auth.users(id) on delete cascade,
  etage text not null check (etage in ('ethos','logos','pathos')),
  titre text not null check (titre = btrim(titre) and length(titre) between 1 and 100),
  primary key (user_id, etage)
);
alter table public.cosmos_titres_etages enable row level security;
create policy titres_etages_owner on public.cosmos_titres_etages to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.cosmos_titres_etages from public, anon;
grant select, insert, update, delete on public.cosmos_titres_etages to authenticated;
grant all on public.cosmos_titres_etages to service_role;

create function public.charger_etat_v4() returns jsonb
language sql security invoker set search_path = public as $$
  select public.charger_etat_v3() || jsonb_build_object('titresEtages',
    coalesce((select jsonb_object_agg(etage,titre) from public.cosmos_titres_etages
      where user_id=(select auth.uid())), '{}'::jsonb));
$$;

create function public.sync_etat_v4(
  p_cosmos text[] default null, p_rows jsonb default '[]'::jsonb,
  p_deleted text[] default '{}'::text[], p_journal jsonb default '[]'::jsonb,
  p_replace boolean default false, p_author text default 'Toi',
  p_etage_de jsonb default null, p_etages jsonb default null,
  p_titres_de jsonb default null, p_expected jsonb default '{}'::jsonb,
  p_sections jsonb default null, p_section_de jsonb default null,
  p_titres_etages jsonb default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid(); current_titles jsonb; result jsonb;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  if p_titres_etages is not null then
    if jsonb_typeof(p_titres_etages) <> 'object' then raise exception 'Titres d’espace invalides.'; end if;
    if exists (select 1 from jsonb_each(p_titres_etages) as entry
      where key not in ('ethos','logos','pathos') or jsonb_typeof(value) <> 'string'
        or length(value #>> '{}') not between 1 and 100
        or (value #>> '{}') <> btrim(value #>> '{}')) then
      raise exception 'Choisis un titre de 1 à 100 caractères pour chaque espace.';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  perform 1 from public.cosmos_titres_etages where user_id=uid order by etage for update;
  select coalesce(jsonb_object_agg(etage,titre),'{}'::jsonb) into current_titles
    from public.cosmos_titres_etages where user_id=uid;
  if not p_replace and p_titres_etages is not null
    and current_titles is distinct from coalesce(p_expected->'titresEtages','{}'::jsonb)
    and current_titles is distinct from p_titres_etages then
    raise exception using errcode='P4090', message='Les titres des espaces ont été modifiés sur un autre appareil.';
  end if;
  result := public.sync_etat_v3(p_cosmos,p_rows,p_deleted,p_journal,p_replace,p_author,
    p_etage_de,p_etages,p_titres_de,p_expected,p_sections,p_section_de);
  if p_replace or p_titres_etages is not null then
    delete from public.cosmos_titres_etages where user_id=uid
      and not (coalesce(p_titres_etages,'{}'::jsonb) ? etage);
  end if;
  if p_titres_etages is not null then
    insert into public.cosmos_titres_etages(user_id,etage,titre)
      select uid,key,value from jsonb_each_text(p_titres_etages)
      on conflict (user_id,etage) do update set titre=excluded.titre
        where cosmos_titres_etages.titre is distinct from excluded.titre;
  end if;
  select coalesce(jsonb_object_agg(etage,titre),'{}'::jsonb) into current_titles
    from public.cosmos_titres_etages where user_id=uid;
  return result || jsonb_build_object('structure', (result->'structure') ||
    jsonb_build_object('titresEtages',current_titles));
end $$;
revoke all on function public.charger_etat_v4(), public.sync_etat_v4(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.charger_etat_v4(), public.sync_etat_v4(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
