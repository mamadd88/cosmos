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
      if (name === 'charger_etat') return { data: actor('select public.charger_etat();') };
      assert.equal(name, 'sync_etat_v2'); h.writes.push(structuredClone(args));
      const params = Object.entries(args).map(([k,v]) => {
        if (v === null) return `${k}=>null`;
        if (k === 'p_cosmos' || k === 'p_deleted') return `${k}=>array[${v.map(q).join(',')}]::text[]`;
        if (typeof v === 'boolean') return `${k}=>${v}`;
        if (typeof v === 'string') return `${k}=>${q(v)}`;
        return `${k}=>${j(v)}`;
      }).join(',');
      const data = actor(`select public.sync_etat_v2(${params});`);
      if (h.loseResponse) { h.loseResponse = false; throw new Error('Failed to fetch'); }
      return { data };
    } catch (e) { return { error: { message: e.message, code: e.code } }; }
  } };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ supabaseUrl: 'https://example.invalid', supabaseKey: 'fake' }) }));
  const old = globalThis.window; globalThis.window = { supabase: { createClient: () => db } }; t.after(() => { globalThis.window = old; });
  h.client = async () => { const sync = await createSync(); sync.onError(e => h.errors.push(e)); return { sync, local: await sync.load() }; };
  h.server = () => actor('select public.charger_etat();');
  h.change = (c, patch, id = 'mc-a') => { c.local = { ...c.local, rows: c.local.rows.map(r => r.id === id ? { ...r, ...patch } : r) }; c.sync.save(c.local); return c.sync.flush(); };
  return h;
}
const integration = (name, fn) => test(name, { skip: !enabled }, fn);

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
