-- Seuls les changements de Valeur actuelle sont conservés dans le Journal.
-- Ignorer une entrée au lieu de lever une erreur permet aux anciens clients
-- de continuer à enregistrer les autres champs dans la même transaction.
create function public.journal_valeur_actuelle_uniquement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
begin
  if new.type is distinct from 'modification'
     or jsonb_typeof(new.changes) is distinct from 'array' then
    return null;
  end if;

  select value into change
  from jsonb_array_elements(new.changes) with ordinality as c(value, position)
  where value->>'field' = 'Valeur actuelle'
    and jsonb_typeof(value->'before') = 'string'
    and jsonb_typeof(value->'after') = 'string'
  order by position
  limit 1;

  if change is null or change->>'before' = change->>'after' then
    return null;
  end if;

  new.changes := jsonb_build_array(jsonb_build_object(
    'field', 'Valeur actuelle', 'before', change->>'before', 'after', change->>'after'
  ));
  new.detail := 'Valeur actuelle modifiée';
  return new;
end;
$$;

revoke all on function public.journal_valeur_actuelle_uniquement() from public, anon;
grant execute on function public.journal_valeur_actuelle_uniquement() to authenticated, service_role;

create trigger journal_valeur_actuelle_uniquement
before insert or update on public.journal
for each row execute function public.journal_valeur_actuelle_uniquement();

comment on table public.journal is
  'Historique des changements réels de Valeur actuelle uniquement, avec les valeurs avant/après.';

-- Conserver la signature pour les anciens clients, sans annoncer une note
-- comme enregistrée alors que les notes sont désormais désactivées.
create or replace function public.agent_noter(p_agent_id uuid, p_detail text, p_mini_id text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Les notes sont désactivées : le Journal conserve uniquement les changements de Valeur actuelle.';
end;
$$;

revoke all on function public.agent_noter(uuid, text, text) from public, anon, authenticated;
grant execute on function public.agent_noter(uuid, text, text) to service_role;

-- Les agents ne produisent plus de changements accessoires ni de doublons à valeur identique.
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
  select * into m from mini_cosmos where id = p_mini_id and user_id = a.user_id for update;
  if not found then raise exception 'mini-cosmos introuvable : %', p_mini_id; end if;
  perform agent_valider_patch(p_patch);
  newdata := m.data;
  for k in select jsonb_object_keys(p_patch) loop
    if k = 'etapes' then
      etapes := case when jsonb_typeof(m.data->'actions') = 'array' then m.data->'actions' else '[]'::jsonb end;
      select etapes || coalesce(jsonb_agg(jsonb_build_object('text', e, 'done', false)), '[]'::jsonb) into etapes
        from jsonb_array_elements_text(p_patch->'etapes') e
       where not exists (select 1 from jsonb_array_elements(etapes) x where x->>'text' = e);
      newdata := jsonb_set(newdata, '{actions}', etapes);
    else
      if jsonb_typeof(p_patch->k) <> 'string' then raise exception 'le champ % doit être un texte', k; end if;
      if k = 'actuel' and coalesce(m.data->>k, '') is distinct from p_patch->>k then
        changes := jsonb_build_array(jsonb_build_object('field', 'Valeur actuelle', 'before', coalesce(m.data->>k, ''), 'after', p_patch->>k));
      end if;
      newdata := jsonb_set(newdata, array[k], p_patch->k);
    end if;
  end loop;
  update mini_cosmos set data = newdata, updated_at = now(), updated_by = a.name where id = m.id and user_id = m.user_id;
  if jsonb_array_length(changes) > 0 then
    insert into journal (id, user_id, author, type, mini_id, mini, cosmos, detail, changes)
    values ('a-' || replace(gen_random_uuid()::text, '-', ''), a.user_id, a.name, 'modification', m.id, m.name, m.cosmos,
            'Valeur actuelle modifiée', changes);
  end if;
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('id', m.id, 'data', newdata);
end $$;

-- La proposition reste disponible, sans événement avant son acceptation.
create or replace function public.agent_proposer(p_agent_id uuid, p_mini_id text, p_patch jsonb, p_motif text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a agents%rowtype; m mini_cosmos%rowtype; pid uuid;
begin
  select * into a from agents where id = p_agent_id and actif;
  if not found then raise exception 'agent inconnu ou révoqué'; end if;
  select * into m from mini_cosmos where id = p_mini_id and user_id = a.user_id;
  if not found then raise exception 'mini-cosmos introuvable : %', p_mini_id; end if;
  perform agent_valider_patch(p_patch);
  insert into propositions (user_id, agent_id, agent_name, mini_id, patch, motif)
  values (a.user_id, a.id, a.name, m.id, p_patch, nullif(trim(p_motif), '')) returning id into pid;
  update agents set last_used_at = now() where id = a.id;
  return jsonb_build_object('propositionId', pid, 'statut', 'en_attente');
end $$;
