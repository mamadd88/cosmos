// Intégration contre une base PostgreSQL LOCALE jetable avec les migrations appliquées.
// COSMOS_TEST_PG_SOCKET=/tmp/... COSMOS_TEST_PG_PORT=55439 node --test tests/cosmos-database.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createSync } from '../cosmos-sync.js';
const socket = process.env.COSMOS_TEST_PG_SOCKET;
const enabled = !!socket && socket.startsWith('/tmp/');
const q = value => "'" + String(value).replaceAll("'", "''") + "'";
const j = value => q(JSON.stringify(value)) + '::jsonb';
function sql(query) {
  const r = spawnSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', socket, '-p', process.env.COSMOS_TEST_PG_PORT || '55439', '-U', 'postgres', '-d', 'postgres'], { input: query, encoding: 'utf8' });
  if (r.status !== 0) throw Object.assign(new Error(r.stderr), { code: r.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1] });
  const last = r.stdout.trim().split('\n').at(-1); return last ? JSON.parse(last) : null;
}
async function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const uid = randomUUID(); sql(`insert into auth.users(id) values (${q(uid)});`);
  t.after(() => sql(`delete from auth.users where id=${q(uid)};`));
  const actor = query => sql(`set role authenticated; select set_config('request.jwt.claim.sub',${q(uid)},false); ${query}`);
  const row = id => ({ id, cosmos: 'TRAVAIL', name: id, objectif: 'Initial', actuel: '0', startAt: '2026-09-01', cloture: '2026-12-31', actions: [], pause: false, closed: false, sasDone: false });
  const rows = [row('mc-a'), row('mc-b')];
  actor(`select public.sync_etat(p_cosmos=>array['TRAVAIL'],p_rows=>${j(rows.map((data,position)=>({id:data.id,data,position})))},p_etage_de=>'{}',p_etages=>'{}',p_titres_de=>'{}');`);
  const h = { actor, uid, writes: [], errors: [], loseResponse: false };
  const db = { async rpc(name, args = {}) {
    try {
      if (name === 'charger_etat_v4') return { data: actor('select public.charger_etat_v4();') };
      assert.equal(name, 'sync_etat_v4'); h.writes.push(structuredClone(args));
      const params = Object.entries(args).map(([k,v]) => {
        if (v === null) return `${k}=>null`;
        if (k === 'p_cosmos' || k === 'p_deleted') return `${k}=>array[${v.map(q).join(',')}]::text[]`;
        if (typeof v === 'boolean') return `${k}=>${v}`;
        if (typeof v === 'string') return `${k}=>${q(v)}`;
        return `${k}=>${j(v)}`;
      }).join(',');
      const data = actor(`select public.sync_etat_v4(${params});`);
      if (h.loseResponse) { h.loseResponse = false; throw new Error('Failed to fetch'); }
      return { data };
    } catch (e) { return { error: { message: e.message, code: e.code } }; }
  } };
  const config = { supabaseUrl: 'https://example.invalid', supabaseKey: 'fake' };
  h.client = async () => { const sync = await createSync({ config, clientFactory: () => db }); sync.onError(e => h.errors.push(e)); return { sync, local: await sync.load() }; };
  h.server = () => actor('select public.charger_etat_v4();');
  h.change = (c, patch, id = 'mc-a') => { c.local = { ...c.local, rows: c.local.rows.map(r => r.id === id ? { ...r, ...patch } : r) }; c.sync.save(c.local); return c.sync.flush(); };
  return h;
}
const integration = (name, fn) => test(name, { skip: !enabled }, fn);

const valueEvent = (id, before = '0', after = '1') => ({
  id, t: new Date().toISOString(), author: 'Toi', type: 'modification', miniId: 'mc-a', mini: 'mc-a', cosmos: 'TRAVAIL',
  detail: 'Ancien client', changes: [{ field: 'Valeur actuelle', before, after }],
});

integration('Postgres : les anciens clients sauvegardent les autres champs sans écrire leurs événements', async t => {
  const h = await setup(t);
  const events = ['creation', 'statut', 'etape', 'deplacement', 'suppression', 'cosmos', 'donnees', 'proposition', 'note']
    .map(type => ({ ...valueEvent(type), type }));
  events.push({ ...valueEvent('objectif'), changes: [{ field: 'Objectif', before: 'Initial', after: 'Modifié' }] });
  events.push(valueEvent('identique', '0', '0'));
  const row = { ...h.server().miniCosmos[0].data, objectif: 'Modifié', pause: true };
  h.actor(`select public.sync_etat(p_rows=>${j([{ id: row.id, data: row, position: 0 }])},p_journal=>${j(events)});`);
  assert.equal(h.server().miniCosmos[0].data.objectif, 'Modifié');
  assert.equal(h.server().miniCosmos[0].data.pause, true);
  assert.deepEqual(h.server().journal, []);
});

integration('Postgres : un événement mixte garde seulement Valeur actuelle, même en écriture directe', async t => {
  const h = await setup(t);
  const changes = [...valueEvent('mixed').changes, { field: 'Objectif', before: 'A', after: 'B' }];
  h.actor(`insert into public.journal(id,type,mini_id,detail,changes) values ('mixed','modification','mc-a','Objectif et valeur',${j(changes)}); select 'null'::jsonb;`);
  let entry = h.server().journal[0];
  assert.deepEqual(entry.changes, valueEvent('mixed').changes);
  assert.equal(entry.detail, 'Valeur actuelle modifiée');
  h.actor(`update public.journal set detail='Autre champ',changes=${j([...valueEvent('mixed', '1', '').changes, {field:'Poids',before:'Normal',after:'Vital'}])} where id='mixed'; select 'null'::jsonb;`);
  entry = h.server().journal[0];
  assert.deepEqual(entry.changes, valueEvent('mixed', '1', '').changes);
  assert.equal(entry.detail, 'Valeur actuelle modifiée');
  h.actor("update public.journal set type='note',changes=null where id='mixed'; select 'null'::jsonb;");
  assert.deepEqual(h.server().journal[0], entry);
  for (const changes of [null, {}, [], [{field:'Valeur actuelle',after:'1'}], [{field:'Valeur actuelle',before:0,after:1}]])
    h.actor(`insert into public.journal(id,type,changes) values ('invalid','modification',${j(changes)}); select 'null'::jsonb;`);
  assert.equal(h.server().journal.length, 1);
});

integration('Postgres : une valeur sauvegardée après perte réseau ne crée qu’un événement', async t => {
  const h = await setup(t), a = await h.client();
  a.local.journal = [valueEvent('retry')];
  h.loseResponse = true;
  await h.change(a, { actuel: '1' }); await a.sync.flush();
  assert.equal(h.server().journal.length, 1);
  assert.deepEqual(h.server().journal[0].changes, valueEvent('retry').changes);
  assert.equal(h.server().miniCosmos[0].data.actuel, '1');
});

integration('Postgres : agents et propositions respectent le Journal limité à Valeur actuelle', async t => {
  const h = await setup(t);
  const aid = sql(`insert into public.agents(user_id,name,key_hash,ecriture_directe) values (${q(h.uid)},'Test valeur',${q(randomUUID())},true) returning to_jsonb(id);`);
  const agent = query => sql(`set role service_role; ${query}`);
  const modify = patch => agent(`select public.agent_modifier(${q(aid)},'mc-a',${j(patch)},'Ne pas recopier ce détail');`);
  modify({ objectif: 'Objectif agent', etapes: ['Étape agent'] });
  assert.equal(h.server().journal.length, 0);
  assert.equal(h.server().miniCosmos[0].data.objectif, 'Objectif agent');
  assert.equal(h.server().miniCosmos[0].data.actions[0].text, 'Étape agent');
  modify({ actuel: '1', objectif: 'Autre objectif' });
  modify({ actuel: '1', poids: 'vital' });
  let entries = h.server().journal;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].author, 'Test valeur');
  assert.equal(entries[0].detail, 'Valeur actuelle modifiée');
  assert.deepEqual(entries[0].changes, valueEvent('agent').changes);
  modify({ actuel: '' });
  entries = h.server().journal;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0].changes, valueEvent('clear', '1', '').changes);
  const proposal = agent(`select public.agent_proposer(${q(aid)},'mc-a','{"actuel":"Proposée"}');`);
  assert.equal(proposal.statut, 'en_attente');
  assert.equal(h.server().propositions.length, 1);
  assert.equal(h.server().journal.length, 2);
  assert.throws(() => agent(`select public.agent_noter(${q(aid)},'Une note');`), /notes sont désactivées/);
  assert.equal(h.server().journal.length, 2);
});

integration('Postgres : le filtrage du Journal conserve l’isolation entre comptes', async t => {
  const h = await setup(t);
  const other = randomUUID(); sql(`insert into auth.users(id) values (${q(other)});`);
  t.after(() => sql(`delete from auth.users where id=${q(other)};`));
  assert.throws(() => h.actor(`insert into public.journal(id,user_id,type,changes) values ('foreign',${q(other)},'modification',${j(valueEvent('foreign').changes)});`), e => e.code === '42501');
  const permissions = sql("select jsonb_build_object('modifierAnon',has_function_privilege('anon','public.agent_modifier(uuid,text,jsonb,text)','execute'),'modifierAuthenticated',has_function_privilege('authenticated','public.agent_modifier(uuid,text,jsonb,text)','execute'),'modifierService',has_function_privilege('service_role','public.agent_modifier(uuid,text,jsonb,text)','execute'),'noterAuthenticated',has_function_privilege('authenticated','public.agent_noter(uuid,text,text)','execute')); ");
  assert.deepEqual(permissions, { modifierAnon: false, modifierAuthenticated: false, modifierService: true, noterAuthenticated: false });
});

integration('Postgres : deux appareils fusionnent leurs champs et les éditions suivantes conservent la fusion', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  await h.change(a,{objectif:'Objectif A'}); await h.change(b,{actuel:'Valeur B'});
  await h.change(b,{actuel:'Valeur B2'});
  let r=h.server().miniCosmos[0].data; assert.equal(r.objectif,'Objectif A'); assert.equal(r.actuel,'Valeur B2');
  await b.sync.poll(()=>b.local,next=>{b.local=next;}); assert.equal(b.local.rows[0].objectif,'Objectif A');
  assert.equal(h.errors.length,0);
});
integration('Postgres : un conflit sur le même champ bloque les retries et conserve la copie locale', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  await h.change(a,{objectif:'A'}); await h.change(b,{objectif:'B'});
  assert.equal(h.server().miniCosmos[0].data.objectif,'A'); assert.equal(b.local.rows[0].objectif,'B');
  assert.equal(h.errors.at(-1).code,'P4090'); const n=h.writes.length;
  t.mock.timers.tick(60000); await b.sync.flush(); assert.equal(h.writes.length,n);
  await h.change(b,{actuel:'B après conflit'}); assert.equal(h.writes.length,n);
  const current=await b.sync.reloadAfterConflict(); b.local=current;
  await h.change(b,{actuel:'B accepté'}); assert.equal(h.server().miniCosmos[0].data.objectif,'A'); assert.equal(h.server().miniCosmos[0].data.actuel,'B accepté');
});
integration('Postgres : un lot conflictuel ne sauvegarde aucun autre champ ni son journal', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  await h.change(a,{objectif:'A'},'mc-b');
  b.local.rows=b.local.rows.map(r=>({...r,objectif:'B'})); b.local.journal=[{id:'audit-journal',t:new Date().toISOString(),type:'modification',detail:'B'}];
  b.sync.save(b.local); await b.sync.flush();
  assert.equal(h.server().miniCosmos[0].data.objectif,'Initial'); assert.equal(h.server().journal.length,0);
  assert.equal(h.errors.at(-1).code,'P4090');
});
integration('Postgres : une suppression distante ne peut pas être ressuscitée par une ancienne fiche', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  a.local.rows=a.local.rows.filter(r=>r.id!=='mc-a'); a.sync.save(a.local); await a.sync.flush();
  await h.change(b,{objectif:'B'}); assert.equal(h.server().miniCosmos.length,1); assert.equal(h.errors.at(-1).code,'P4090');
});
integration('Postgres : une suppression locale ne détruit pas une modification distante', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client(); await h.change(a,{objectif:'A'});
  b.local.rows=b.local.rows.filter(r=>r.id!=='mc-a'); b.sync.save(b.local); await b.sync.flush();
  assert.equal(h.server().miniCosmos.length,2); assert.equal(h.server().miniCosmos[0].data.objectif,'A'); assert.equal(h.errors.at(-1).code,'P4090');
});
integration('Postgres : un changement d’ordre conserve les champs modifiés ailleurs', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client(); await h.change(a,{objectif:'A'});
  b.local.rows.reverse(); b.sync.save(b.local); await b.sync.flush();
  assert.equal(h.server().miniCosmos[0].id,'mc-b'); assert.equal(h.server().miniCosmos[1].data.objectif,'A'); assert.equal(h.errors.length,0);
});
integration('Postgres : un conflit de titres protège la structure distante', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  a.local.titresDe={TRAVAIL:['A']}; a.sync.save(a.local); await a.sync.flush();
  b.local.titresDe={TRAVAIL:['B']}; b.sync.save(b.local); await b.sync.flush();
  assert.deepEqual(h.server().titresDe,{TRAVAIL:['A']}); assert.equal(h.errors.at(-1).code,'P4090');
});
integration('Postgres : une réponse perdue se rejoue sans doublon', async t => {
  const h=await setup(t), a=await h.client(); h.loseResponse=true;
  await h.change(a,{objectif:'A'}); await a.sync.flush();
  assert.equal(h.server().miniCosmos[0].data.objectif,'A'); assert.equal(h.errors.filter(e=>e.code==='P4090').length,0);
});
integration('Postgres : la RPC reste isolée par compte et inaccessible anonymement', async t => {
  const h=await setup(t), a=await h.client();
  const other=randomUUID(); sql(`insert into auth.users(id) values (${q(other)});`); t.after(()=>sql(`delete from auth.users where id=${q(other)};`));
  const d=sql(`set role authenticated; select set_config('request.jwt.claim.sub',${q(other)},false); select public.charger_etat();`);
  assert.equal(d.miniCosmos.length,0); await h.change(a,{objectif:'Compte A'});
  const privileges=sql("select jsonb_build_object('anon',has_function_privilege('anon','public.sync_etat_v2(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb)','execute'),'authenticated',has_function_privilege('authenticated','public.sync_etat_v2(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb)','execute')); ");
  assert.deepEqual(privileges,{anon:false,authenticated:true});
});

integration('Postgres : la reprise réseau fonctionne aussi après une modification de titres', async t => {
  const h=await setup(t), a=await h.client(); h.loseResponse=true;
  a.local.titresDe={TRAVAIL:['A']}; a.sync.save(a.local); await a.sync.flush(); await a.sync.flush();
  assert.deepEqual(h.server().titresDe,{TRAVAIL:['A']}); assert.equal(h.errors.filter(e=>e.code==='P4090').length,0);
});
integration('Postgres : supprimer le dernier titre puis en ajouter un ne crée pas de faux conflit', async t => {
  const h=await setup(t), a=await h.client();
  for (const list of [['A'],[],['B']]) { a.local.titresDe={TRAVAIL:list}; a.sync.save(a.local); await a.sync.flush(); }
  assert.deepEqual(h.server().titresDe,{TRAVAIL:['B']}); assert.equal(h.errors.length,0);
});

integration('Postgres : réouvrir supprime closedAt et conserve l’échéance prévue', async t => {
  const h=await setup(t), a=await h.client();
  await h.change(a,{closed:true,closedAt:'2026-09-06'}); await h.change(a,{closed:false,closedAt:undefined});
  const r=h.server().miniCosmos[0].data; assert.equal(r.closedAt,undefined); assert.equal(r.cloture,'2026-12-31'); assert.equal(h.errors.length,0);
});

integration('Postgres : la fusion ne mélange pas des dates modifiées indépendamment', async t => {
  const h=await setup(t), a=await h.client(), b=await h.client();
  await h.change(a,{startAt:'2026-11-01'}); await h.change(b,{cloture:'2026-10-01'});
  const r=h.server().miniCosmos[0].data; assert.equal(r.startAt,'2026-11-01'); assert.equal(r.cloture,'2026-12-31'); assert.equal(h.errors.at(-1).code,'P4090');
});

const section = (id = 'sec-a', name = 'Projets', etage = 'logos') => ({ id, name, etage });
const organize = async (client, patch) => {
  client.local = { ...client.local, ...patch };
  client.sync.save(client.local); await client.sync.flush();
};
integration('Postgres : séparations et rangement se sauvegardent sans événement, leur suppression conserve les cosmos et minis', async t => {
  const h = await setup(t), a = await h.client();
  const before = h.server().miniCosmos;
  await organize(a, { sections: [section()], sectionDe: { TRAVAIL: 'sec-a' } });
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.server().sections, [section()]);
  assert.deepEqual(h.server().sectionDe, { TRAVAIL: 'sec-a' });
  await organize(a, { sections: [section('sec-a', 'Moteurs')] });
  assert.deepEqual(h.server().sections, [section('sec-a', 'Moteurs')]);
  assert.equal(h.server().sectionDe.TRAVAIL, 'sec-a');
  await organize(a, { sections: [], sectionDe: {} });
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.server().sections, []);
  assert.deepEqual(h.server().sectionDe, {});
  assert.deepEqual(h.server().cosmos, ['TRAVAIL']);
  assert.deepEqual(h.server().miniCosmos, before);
  assert.deepEqual(h.server().journal, []);
});

integration('Postgres : un ancien client conserve les séparations en modifiant le repère, et libère un cosmos déplacé vers un autre étage', async t => {
  const h = await setup(t), a = await h.client();
  await organize(a, { sections: [section()], sectionDe: { TRAVAIL: 'sec-a' } });
  h.actor(`select public.sync_etat_v2(p_etages=>' {"logos":"Ancien onglet"}',p_expected=>' {"etages":{}}');`);
  assert.deepEqual(h.server().sections, [section()]);
  assert.equal(h.server().sectionDe.TRAVAIL, 'sec-a');
  h.actor(`select public.sync_etat(p_etage_de=>' {"TRAVAIL":"ethos"}');`);
  assert.equal(h.server().etageDe.TRAVAIL, 'ethos');
  assert.deepEqual(h.server().sectionDe, {});
  assert.deepEqual(h.server().sections, [section()]);
  assert.equal(h.server().miniCosmos.length, 2);
});

integration('Postgres : les conflits de séparations entre appareils conservent les deux copies', async t => {
  const h = await setup(t), a = await h.client(), b = await h.client();
  await organize(a, { sections: [section()] });
  await organize(b, { sections: [section('sec-b', 'Autre')] });
  assert.equal(h.errors.at(-1).code, 'P4090');
  assert.equal(b.sync.hasPending(), true);
  assert.deepEqual(h.server().sections, [section()]);
  const c = await h.client(), d = await h.client();
  await organize(c, { sectionDe: { TRAVAIL: 'sec-a' } });
  await organize(d, { sections: [] });
  assert.equal(h.errors.at(-1).code, 'P4090', 'un cosmos nouvellement rangé empêche la suppression obsolète de sa section');
  assert.equal(h.server().sectionDe.TRAVAIL, 'sec-a');
});

integration('Postgres : un rangement rejoué après perte réseau reste idempotent et fusionne avec une valeur actuelle indépendante', async t => {
  const h = await setup(t), a = await h.client(), b = await h.client();
  h.loseResponse = true;
  await organize(a, { sections: [section()], sectionDe: { TRAVAIL: 'sec-a' } });
  await a.sync.flush();
  assert.equal(a.sync.hasPending(), false);
  await h.change(b, { actuel: '2' });
  assert.equal(h.server().miniCosmos[0].data.actuel, '2');
  assert.deepEqual(h.server().sections, [section()]);
  assert.equal(h.server().sectionDe.TRAVAIL, 'sec-a');
  assert.deepEqual(h.server().journal, []);
});

integration('Postgres : renommage de cosmos, import et suppression directe préservent les relations attendues', async t => {
  const h = await setup(t), a = await h.client();
  await organize(a, { sections: [section()], sectionDe: { TRAVAIL: 'sec-a' } });
  await organize(a, { cosmos: ['PROJETS'], etageDe: { PROJETS: 'logos' }, sectionDe: { PROJETS: 'sec-a' }, rows: a.local.rows.map(r => ({ ...r, cosmos: 'PROJETS' })) });
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.server().sectionDe, { PROJETS: 'sec-a' });
  h.actor(`delete from public.cosmos_sections where id='sec-a'; select 'null'::jsonb;`);
  assert.equal(h.server().miniCosmos.length, 2); assert.deepEqual(h.server().sectionDe, {});
  await organize(a, { replace: true, cosmos: ['TRAVAIL'], etageDe: { TRAVAIL: 'logos' }, sections: [section('sec-b', 'Importée')], sectionDe: { TRAVAIL: 'sec-b' }, rows: a.local.rows.map(r => ({ ...r, cosmos: 'TRAVAIL' })) });
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.server().sections, [section('sec-b', 'Importée')]);
  assert.equal(h.server().sectionDe.TRAVAIL, 'sec-b');
  await organize(a, { replace: true, sections: [], sectionDe: {} });
  assert.deepEqual(h.server().sections, []);
});

integration('Postgres : rangement invalide et comptes distincts sont protégés par transaction, RLS et contraintes', async t => {
  const h = await setup(t), a = await h.client();
  await organize(a, { sections: [section()] });
  const other = randomUUID(); sql(`insert into auth.users(id) values (${q(other)});`);
  t.after(() => sql(`delete from auth.users where id=${q(other)};`));
  const otherActor = query => sql(`set role authenticated; select set_config('request.jwt.claim.sub',${q(other)},false); ${query}`);
  assert.deepEqual(otherActor('select public.charger_etat_v4();').sections, []);
  assert.throws(() => otherActor(`insert into public.cosmos_sections(user_id,id,name,etage) values (${q(h.uid)},'steal','Vol','logos');`), /row-level security/);
  assert.throws(() => h.actor(`begin; insert into public.cosmos_sections(user_id,id,name,etage) values (${q(h.uid)},'ethos-only','Vertus','ethos'); update public.cosmos set section_id='ethos-only' where name='TRAVAIL'; commit;`), /même compte et au même étage/);
  assert.deepEqual(h.server().sections, [section()], 'tout le lot invalide est annulé');
  const c = await h.client();
  await organize(c, { sections: [section('sec-new', 'Nouvelle')], sectionDe: { INCONNU: 'sec-new' } });
  assert.ok(h.errors.length); assert.deepEqual(h.server().sections, [section()]);
  const privileges = sql("select jsonb_build_object('anon',has_function_privilege('anon','public.charger_etat_v4()','execute'),'auth',has_function_privilege('authenticated','public.charger_etat_v4()','execute'),'write_anon',has_function_privilege('anon','public.sync_etat_v4(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'));");
  assert.deepEqual(privileges, { anon: false, auth: true, write_anon: false });
});

integration('Postgres : création rapide, réponse perdue, relecture et reprise conservent les données sans Journal de création', async t => {
  const h = await setup(t), a = await h.client();
  const row = { id: 'quick-test', name: 'Idée', cosmos: 'TRAVAIL', draft: true, pause: true, closed: false, sasDone: false, actions: [], history: [], startAt: '', cloture: '', createdAt: '2026-09-08', objectif: '', actuel: '', entropie: '', reponse: '' };
  h.loseResponse = true;
  await organize(a, { rows: [...a.local.rows, row] }); await a.sync.flush();
  assert.equal(a.sync.hasPending(), false);
  assert.equal(h.server().miniCosmos.filter(x => x.id === row.id).length, 1);
  const b = await h.client();
  const loaded = b.local.rows.find(x => x.id === row.id);
  assert.equal(loaded.draft, true); assert.equal(loaded.cloture, ''); assert.equal(loaded.startAt, '');
  await h.change(b, { objectif: 'À préciser' }, row.id);
  assert.equal(h.server().miniCosmos.find(x => x.id === row.id).data.cloture, '');
  await h.change(b, { entropie: 'Dispersion', reponse: 'Choisir', startAt: '2026-09-08', cloture: '2027-09-08', pause: false, draft: false }, row.id);
  const saved = h.server().miniCosmos.find(x => x.id === row.id).data;
  assert.equal(saved.pause, false); assert.equal(saved.draft, false); assert.equal(saved.objectif, 'À préciser');
  assert.deepEqual(h.server().journal, []);
});

integration('Postgres : titres des espaces sauvegardés sans Journal, relus, et protégés des anciens clients', async t => {
  const h = await setup(t), a = await h.client();
  const original = h.server();
  h.loseResponse = true;
  await organize(a, { titresEtages: { ethos: 'V'.repeat(300), logos: 'ATELIER', pathos: 'LIENS' } });
  await a.sync.flush();
  assert.equal(a.sync.hasPending(), false, 'la relance après une réponse perdue est idempotente');
  const b = await h.client();
  assert.deepEqual(b.local.titresEtages, a.local.titresEtages);
  assert.deepEqual(h.server().miniCosmos, original.miniCosmos);
  assert.deepEqual(h.server().etageDe, original.etageDe);
  assert.deepEqual(h.server().journal, []);
  h.actor(`select public.sync_etat_v3(p_etages=>' {"logos":"Repère ancien client"}',p_expected=>' {"etages":{}}');`);
  assert.deepEqual(h.server().titresEtages, a.local.titresEtages);
  assert.deepEqual(h.server().etages, { logos: 'Repère ancien client' });
  await organize(b, { titresEtages: {} });
  assert.deepEqual(h.server().titresEtages, {});
  assert.deepEqual(h.server().journal, []);
});

integration('Postgres : titres des espaces isolés par compte, validés et protégés contre les conflits', async t => {
  const h = await setup(t), a = await h.client(), stale = await h.client();
  await organize(a, { titresEtages: { logos: 'ATELIER' } });
  await organize(stale, { titresEtages: { logos: 'PÉRIMÉ' } });
  assert.equal(h.errors.at(-1).code, 'P4090');
  assert.deepEqual(h.server().titresEtages, { logos: 'ATELIER' });
  const before = h.server();
  const row = { ...before.miniCosmos[0].data, name: 'NE DOIT PAS CHANGER' };
  for (const value of [[], { inconnu: 'Autre' }, { ethos: '' }, { ethos: ' espace ' }, { ethos: null }, { ethos: 123 }, { ethos: 'x'.repeat(301) }]) {
    assert.throws(() => h.actor(`select public.sync_etat_v4(p_rows=>${j([{ id: row.id, data: row, position: 0 }])},p_titres_etages=>${j(value)});`), /invalides|300 caractères/);
  }
  assert.deepEqual(h.server().miniCosmos, before.miniCosmos);
  const other = randomUUID(); sql(`insert into auth.users(id) values (${q(other)});`);
  t.after(() => sql(`delete from auth.users where id=${q(other)};`));
  const otherActor = query => sql(`set role authenticated; select set_config('request.jwt.claim.sub',${q(other)},false); ${query}`);
  assert.deepEqual(otherActor('select public.charger_etat_v4();').titresEtages, {});
  assert.throws(() => otherActor(`insert into public.cosmos_titres_etages(user_id,etage,titre) values (${q(h.uid)},'pathos','Vol');`), /row-level security/);
  otherActor(`update public.cosmos_titres_etages set titre='Vol' where user_id=${q(h.uid)}; select '{}'::jsonb;`);
  assert.deepEqual(h.server().titresEtages, { logos: 'ATELIER' });
  const rights = sql("select jsonb_build_object('read_anon',has_table_privilege('anon','public.cosmos_titres_etages','select'),'write_anon',has_function_privilege('anon','public.sync_etat_v4(text[],jsonb,text[],jsonb,boolean,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)','execute'),'read_auth',has_function_privilege('authenticated','public.charger_etat_v4()','execute'));");
  assert.deepEqual(rights, { read_anon: false, write_anon: false, read_auth: true });
});
