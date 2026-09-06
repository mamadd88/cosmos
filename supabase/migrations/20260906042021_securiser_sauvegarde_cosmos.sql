-- Sauvegarde optimiste : fusionner les champs indépendants, refuser tout conflit.
-- L'ancienne RPC reste disponible pour les onglets ouverts avant le déploiement.
create or replace function public.sync_etat_v2(
  p_cosmos text[] default null, p_rows jsonb default '[]'::jsonb,
  p_deleted text[] default '{}'::text[], p_journal jsonb default '[]'::jsonb,
  p_replace boolean default false, p_author text default 'Toi',
  p_etage_de jsonb default null, p_etages jsonb default null,
  p_titres_de jsonb default null, p_expected jsonb default '{}'::jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  r jsonb; current_row mini_cosmos%rowtype; merged jsonb; field text;
  payload jsonb := '[]'::jsonb; pos integer; current_structure jsonb; result jsonb;
  row_exists boolean; row_id text;
begin
  if uid is null then raise exception 'non authentifié'; end if;
  -- Sérialise les sauvegardes v2 d'un compte. Les verrous de lignes protègent aussi
  -- contre les agents et les anciens clients qui écrivent directement dans les tables.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  perform 1 from cosmos where user_id = uid order by name for update;
  perform 1 from etages where user_id = uid order by etage for update;
  perform 1 from mini_cosmos where user_id = uid and
    (p_replace or id = any(p_deleted) or id in (select x->>'id' from jsonb_array_elements(p_rows) x)) order by id for update;

  select jsonb_build_object(
    'cosmos',coalesce((select jsonb_agg(name order by position,name) from cosmos where user_id=uid),'[]'::jsonb),
    'etageDe',coalesce((select jsonb_object_agg(name,etage) from cosmos where user_id=uid),'{}'::jsonb),
    'etages',coalesce((select jsonb_object_agg(etage,repere) from etages where user_id=uid and repere<>''),'{}'::jsonb),
    'titresDe',coalesce((select jsonb_object_agg(name,titres) from cosmos where user_id=uid and titres<>'[]'::jsonb),'{}'::jsonb)
  ) into current_structure;
  if not p_replace then
    if (p_cosmos is not null and current_structure->'cosmos' is distinct from p_expected->'cosmos' and current_structure->'cosmos' is distinct from to_jsonb(p_cosmos))
       or (p_etage_de is not null and current_structure->'etageDe' is distinct from p_expected->'etageDe' and current_structure->'etageDe' is distinct from p_etage_de)
       or (p_etages is not null and current_structure->'etages' is distinct from p_expected->'etages' and current_structure->'etages' is distinct from (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(p_etages) where value <> '""'::jsonb))
       or (p_titres_de is not null and current_structure->'titresDe' is distinct from p_expected->'titresDe' and current_structure->'titresDe' is distinct from (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(p_titres_de) where value <> '[]'::jsonb)) then
      raise exception using errcode='P4090', message='La structure des cosmos a été modifiée sur un autre appareil.';
    end if;
    foreach row_id in array p_deleted loop
      select * into current_row from mini_cosmos where user_id=uid and id=row_id;
      if found and (current_row.data is distinct from p_expected->'deleted'->row_id->'data'
          or current_row.position is distinct from (p_expected->'deleted'->row_id->>'position')::integer) then
        raise exception using errcode='P4090', message='Un mini-cosmos à supprimer a été modifié sur un autre appareil.';
      end if;
    end loop;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    select * into current_row from mini_cosmos where user_id=uid and id=r->>'id';
    row_exists := found;
    pos := coalesce((r->>'position')::integer,0);
    if p_replace then merged := r->'data';
    elsif r->'base' = 'null'::jsonb then
      if row_exists then
        -- Même lot rejoué après une réponse réseau perdue : résultat déjà appliqué.
        if current_row.data is distinct from (r->'data')-'tags' then
          raise exception using errcode='P4090', message='Ce mini-cosmos existe déjà avec un contenu différent.';
        end if;
      end if;
      merged := r->'data';
    else
      if not row_exists then
        raise exception using errcode='P4090', message='Ce mini-cosmos a été supprimé sur un autre appareil.';
      end if;
      -- Les dates forment un ensemble : deux changements séparément valides
      -- pourraient produire une fin avant le début après fusion.
      if (r->'changed') ?| array['startAt','cloture','sas','sasUntil'] and exists (
        select 1 from unnest(array['startAt','cloture','sas','sasUntil']) k
        where (current_row.data->k) is distinct from (r->'base'->k)
          and (current_row.data->k) is distinct from (r->'data'->k)
      ) then
        raise exception using errcode='P4090', message='Les dates ou le SAS de ce mini-cosmos ont été modifiés sur un autre appareil.';
      end if;
      merged := current_row.data;
      for field in select jsonb_array_elements_text(r->'changed') loop
        if (current_row.data->field) is distinct from (r->'base'->field)
           and (current_row.data->field) is distinct from (r->'data'->field) then
          raise exception using errcode='P4090', message='Le champ « '||field||' » de « '||coalesce(current_row.data->>'name',r->>'id')||' » a été modifié sur un autre appareil.';
        end if;
        if r->'data' ? field then merged := jsonb_set(merged,array[field],r->'data'->field);
        else merged := merged - field; end if;
      end loop;
      if coalesce((r->>'positionChanged')::boolean,false) then
        if current_row.position is distinct from (r->>'basePosition')::integer and current_row.position is distinct from pos then
          raise exception using errcode='P4090', message='L’ordre des mini-cosmos a été modifié sur un autre appareil.';
        end if;
      else pos := current_row.position; end if;
    end if;
    if not (coalesce(to_jsonb(p_cosmos),current_structure->'cosmos') ? (merged->>'cosmos')) then
      raise exception using errcode='P4090', message='Le cosmos parent a été supprimé ou renommé sur un autre appareil.';
    end if;
    payload := payload || jsonb_build_array(jsonb_build_object('id',r->>'id','data',merged,'position',pos));
  end loop;

  result := public.sync_etat(p_cosmos,payload,p_deleted,p_journal,p_replace,p_author,p_etage_de,p_etages,p_titres_de);
  return result || jsonb_build_object('rows',payload,'structure',jsonb_build_object(
    'cosmos',coalesce((select jsonb_agg(name order by position,name) from cosmos where user_id=uid),'[]'::jsonb),
    'etageDe',coalesce((select jsonb_object_agg(name,etage) from cosmos where user_id=uid),'{}'::jsonb),
    'etages',coalesce((select jsonb_object_agg(etage,repere) from etages where user_id=uid and repere<>''),'{}'::jsonb),
    'titresDe',coalesce((select jsonb_object_agg(name,titres) from cosmos where user_id=uid and titres<>'[]'::jsonb),'{}'::jsonb)
  ));
end $$;
revoke all on function public.sync_etat_v2(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.sync_etat_v2(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb) to authenticated;
