-- SAS daté : la fin du test d'entrée vit dans data->>'sasUntil' (AAAA-MM-JJ).
-- Tant que le SAS n'est pas franchi, l'app projette vers cette date (tableau, filtres, statistiques).

alter table public.mini_cosmos
  add column sas_until text generated always as (data->>'sasUntil') stored;

create or replace function public.agent_champ_libelle(k text) returns text language sql immutable as $$
  select case k when 'objectif' then 'Objectif' when 'actuel' then 'Valeur actuelle' when 'entropie' then 'Entropie'
                when 'reponse' then 'Réponse entropie' when 'sas' then 'SAS' when 'sasUntil' then 'Fin du test'
                when 'alerte' then 'Alerte' when 'kill' then 'Kill' when 'etapes' then 'Étapes' else k end;
$$;

create or replace function public.agent_valider_patch(p_patch jsonb) returns void language plpgsql immutable as $$
declare bad text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'patch vide : objet attendu avec au moins un champ';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
   where k not in ('objectif','actuel','entropie','reponse','sas','sasUntil','alerte','kill','etapes');
  if bad is not null then
    raise exception 'champs non autorisés : % (autorisés : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes)', bad;
  end if;
  if p_patch ? 'etapes' and jsonb_typeof(p_patch->'etapes') <> 'array' then
    raise exception 'etapes doit être une liste de textes';
  end if;
  if p_patch ? 'sasUntil' and (jsonb_typeof(p_patch->'sasUntil') <> 'string' or (p_patch->>'sasUntil') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'sasUntil doit être une date AAAA-MM-JJ (fin du test)';
  end if;
end $$;

-- Fin du test déduite du texte du SAS, même règle que l'app : date explicite « (30/09) », sinon « 14 jours » /
-- « 2 semaines » / « 1 mois » comptés depuis le début, sinon 14 jours.
create or replace function public.sas_until_deduit(p_sas text, p_base date) returns date language plpgsql immutable as $$
declare m text[]; y int; d date;
begin
  m := regexp_match(coalesce(p_sas, ''), '\((\d{1,2})/(\d{1,2})(?:/(\d{4}))?\)');
  if m is not null then
    y := coalesce(m[3]::int, extract(year from p_base)::int);
    begin d := make_date(y, m[2]::int, m[1]::int); exception when others then d := null; end;
    if d is not null then
      if m[3] is null and d < p_base then d := (d + interval '1 year')::date; end if;
      return d;
    end if;
  end if;
  m := regexp_match(coalesce(p_sas, ''), '(\d+)\s*(jours?|j)\M', 'i');
  if m is not null then return p_base + m[1]::int; end if;
  m := regexp_match(coalesce(p_sas, ''), '(\d+)\s*(semaines?|sem)\M', 'i');
  if m is not null then return p_base + 7 * m[1]::int; end if;
  m := regexp_match(coalesce(p_sas, ''), '(\d+)\s*mois\M', 'i');
  if m is not null then return (p_base + (m[1]::int * interval '1 month'))::date; end if;
  return p_base + 14;
end $$;

-- Reprise des mini-cosmos existants : un SAS en cours reçoit sa date
update public.mini_cosmos
   set data = jsonb_set(data, '{sasUntil}', to_jsonb(
         sas_until_deduit(sas, coalesce(
           case when data->>'startAt'   ~ '^\d{4}-\d{2}-\d{2}$' then (data->>'startAt')::date   end,
           case when data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}$' then (data->>'createdAt')::date end,
           current_date))::text))
 where sas is not null and sas <> '' and sas <> '—' and not sas_done and not closed and (data->>'sasUntil') is null;
