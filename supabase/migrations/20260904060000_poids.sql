-- Poids d'un mini-cosmos : vital / important / normal (défaut). Structurel : il ordonne et hiérarchise, sans colorer l'état.
alter table public.mini_cosmos
  add column poids text generated always as (coalesce(nullif(data->>'poids', ''), 'normal')) stored;

create or replace function public.agent_champ_libelle(k text) returns text language sql immutable as $$
  select case k when 'objectif' then 'Objectif' when 'actuel' then 'Valeur actuelle' when 'entropie' then 'Entropie'
                when 'reponse' then 'Réponse entropie' when 'sas' then 'SAS' when 'sasUntil' then 'Fin du test'
                when 'alerte' then 'Alerte' when 'kill' then 'Kill' when 'etapes' then 'Étapes' when 'tags' then 'Lentilles'
                when 'poids' then 'Poids' else k end;
$$;

create or replace function public.agent_valider_patch(p_patch jsonb) returns void language plpgsql immutable as $$
declare bad text;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'patch vide : objet attendu avec au moins un champ';
  end if;
  select string_agg(k, ', ') into bad from jsonb_object_keys(p_patch) k
   where k not in ('objectif','actuel','entropie','reponse','sas','sasUntil','alerte','kill','etapes','tags','poids');
  if bad is not null then
    raise exception 'champs non autorisés : % (autorisés : objectif, actuel, entropie, reponse, sas, sasUntil, alerte, kill, etapes, tags, poids)', bad;
  end if;
  if p_patch ? 'etapes' and jsonb_typeof(p_patch->'etapes') <> 'array' then raise exception 'etapes doit être une liste de textes'; end if;
  if p_patch ? 'tags' and jsonb_typeof(p_patch->'tags') <> 'array' then raise exception 'tags doit être une liste de noms de lentilles existantes'; end if;
  if p_patch ? 'sasUntil' and (jsonb_typeof(p_patch->'sasUntil') <> 'string' or (p_patch->>'sasUntil') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'sasUntil doit être une date AAAA-MM-JJ (fin du test)';
  end if;
  if p_patch ? 'poids' and (jsonb_typeof(p_patch->'poids') <> 'string' or (p_patch->>'poids') not in ('vital','important','normal')) then
    raise exception 'poids doit valoir vital, important ou normal';
  end if;
end $$;
