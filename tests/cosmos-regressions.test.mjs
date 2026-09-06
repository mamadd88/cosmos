import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as core from '../cosmos-core.js';
import { createSync } from '../cosmos-sync.js';

process.env.TZ = 'Europe/Paris';
const clone = value => structuredClone(value);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const mini = (id, cosmos = 'TRAVAIL') => ({ id, cosmos, name: id, startAt: '2026-09-01', cloture: '2026-12-31', actions: [], pause: false, closed: false, sasDone: false });
const snapshot = (rows = [mini('mc-a'), mini('mc-b')]) => ({
  cosmos: ['TRAVAIL'], etageDe: { TRAVAIL: 'logos' }, etages: { logos: 'Mon repère' }, titresDe: {},
  miniCosmos: rows.map((data, position) => ({ id: data.id, data, position, updated_at: '2026-09-06T10:00:00Z', updated_by: 'Autre appareil' })),
  journal: [], journalArchived: 0, propositions: [], now: '2026-09-06T10:00:00Z',
});

async function setup(t, initial = snapshot()) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const server = { state: clone(initial), writes: [], reads: 0, readGate: null, writeGate: null, failWrite: false };
  const db = { async rpc(name, args) {
    if (name === 'charger_etat') {
      server.reads++;
      const data = clone(server.state);
      if (server.readGate) await server.readGate.promise;
      return { data, error: null };
    }
    assert.equal(name, 'sync_etat');
    server.writes.push(clone(args));
    if (server.writeGate) await server.writeGate.promise;
    if (server.failWrite) return { error: { message: 'Réseau indisponible' } };
    if (args.p_replace) server.state = snapshot([]);
    if (args.p_cosmos) server.state.cosmos = clone(args.p_cosmos);
    for (const [arg, key] of [['p_etage_de', 'etageDe'], ['p_etages', 'etages'], ['p_titres_de', 'titresDe']]) {
      if (args[arg]) server.state[key] = clone(args[arg]);
    }
    server.state.miniCosmos = server.state.miniCosmos.filter(r => !args.p_deleted.includes(r.id));
    for (const row of args.p_rows) {
      const i = server.state.miniCosmos.findIndex(r => r.id === row.id);
      const saved = { ...clone(row), updated_at: '2026-09-06T10:01:00Z', updated_by: 'Toi' };
      if (i < 0) server.state.miniCosmos.push(saved); else server.state.miniCosmos[i] = saved;
    }
    server.state.miniCosmos.sort((a, b) => a.position - b.position);
    server.state.journal.push(...clone(args.p_journal));
    return { data: { savedAt: '2026-09-06T10:01:00Z' }, error: null };
  } };
  const previousWindow = globalThis.window;
  globalThis.window = { supabase: { createClient: () => db } };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ supabaseUrl: 'https://example.invalid', supabaseKey: 'test' }) }));
  const sync = await createSync();
  let local = await sync.load();
  local.rows = core.migrate(local.rows);
  sync.prime(local);
  return { server, sync, get local() { return local; }, set local(value) { local = value; },
    poll: () => sync.poll(() => local, next => { local = next; }) };
}

test('la relève applique suppressions, ajouts, renommage, ordre et structure sans réécrire la base', async t => {
  const h = await setup(t);
  h.server.state = {
    ...snapshot([mini('mc-b', 'PROJETS'), mini('mc-c', 'SANTÉ')]),
    cosmos: ['SANTÉ', 'PROJETS'], etageDe: { SANTÉ: 'ethos', PROJETS: 'logos' },
    etages: { ethos: 'Prendre soin de soi', logos: 'Créer' }, titresDe: { PROJETS: ['En cours', 'À venir'] },
  };
  h.server.state.miniCosmos[0].data.titre = 'En cours';
  const changes = await h.poll();
  assert.deepEqual(changes.deleted, ['mc-a']);
  assert.deepEqual(h.local.rows.map(r => r.id), ['mc-b', 'mc-c']);
  assert.equal(h.local.rows[0].cosmos, 'PROJETS');
  assert.equal(h.local.rows[0].titre, 'En cours');
  assert.deepEqual(h.local.cosmos, ['SANTÉ', 'PROJETS']);
  assert.deepEqual(h.local.etageDe, { SANTÉ: 'ethos', PROJETS: 'logos' });
  assert.deepEqual(h.local.etages, { ethos: 'Prendre soin de soi', logos: 'Créer' });
  assert.deepEqual(h.local.titresDe.PROJETS, ['En cours', 'À venir']);
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(h.server.writes.length, 0, 'une suppression distante ne doit pas être annulée par la sauvegarde locale');
});

test('la relève récupère un nouvel ordre et les effacements de titres et repères sans modification des dates', async t => {
  const h = await setup(t, { ...snapshot(), titresDe: { TRAVAIL: ['Titre'] } });
  h.server.state.miniCosmos.reverse();
  h.server.state.miniCosmos.forEach((r, i) => { r.position = i; });
  h.server.state.titresDe = {};
  h.server.state.etages = {};
  await h.poll();
  assert.deepEqual(h.local.rows.map(r => r.id), ['mc-b', 'mc-a']);
  assert.deepEqual(h.local.titresDe, {});
  assert.deepEqual(h.local.etages, {});
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
});

test('une base vidée reste vide après la relève', async t => {
  const h = await setup(t);
  h.server.state = { ...snapshot([]), cosmos: [], etageDe: {}, etages: {} };
  await h.poll();
  assert.deepEqual(h.local.rows, []);
  assert.deepEqual(h.local.cosmos, []);
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
});

test('le journal et les propositions reflètent aussi les retraits et l’archivage', async t => {
  const h = await setup(t, { ...snapshot(), journal: [{ id: 'j-old', t: '2025-09-06T10:00:00Z', type: 'note', author: 'Toi' }], propositions: [{ id: 'p-old', agent: 'Agent', miniId: 'mc-a' }] });
  h.server.state.journal = [{ id: 'j-new', t: '2026-09-06T10:01:00Z', type: 'note', author: 'Agent', detail: 'Relève' }];
  h.server.state.journalArchived = 1;
  h.server.state.propositions = [];
  await h.poll();
  assert.deepEqual(h.local.journal.map(j => j.id), ['j-new']);
  assert.equal(h.local.journalArchived, 1);
  assert.deepEqual(h.local.propositions, []);
});

test('une relève inchangée conserve les références, même si Postgres réordonne les clés JSON', async t => {
  const h = await setup(t);
  const previous = h.local;
  h.server.state.miniCosmos.forEach(r => { r.data = Object.fromEntries(Object.entries(r.data).reverse()); });
  const changes = await h.poll();
  assert.deepEqual(changes.rows, []);
  for (const key of ['rows', 'cosmos', 'etageDe', 'etages', 'titresDe', 'journal', 'propositions']) assert.equal(h.local[key], previous[key]);
});

test('une suppression ou modification locale non sauvegardée diffère la relève', async t => {
  const h = await setup(t);
  h.local = { ...h.local, rows: h.local.rows.slice(1), etages: { logos: 'Saisie locale' } };
  assert.equal(await h.poll(), null);
  assert.equal(h.server.reads, 1);
  assert.equal(h.local.etages.logos, 'Saisie locale');
  h.sync.save(h.local);
  assert.equal(await h.poll(), null);
  await h.sync.flush();
  await h.poll();
  assert.deepEqual(h.local.rows.map(r => r.id), ['mc-b']);
});

test('une saisie commencée pendant la requête ne peut pas être écrasée', async t => {
  const h = await setup(t);
  h.server.state.miniCosmos[0].data.name = 'Nom distant';
  h.server.readGate = deferred();
  const polling = h.poll();
  h.local = { ...h.local, rows: h.local.rows.map(r => r.id === 'mc-a' ? { ...r, name: 'Ma saisie' } : r) };
  h.server.readGate.resolve();
  assert.equal(await polling, null);
  assert.equal(h.local.rows[0].name, 'Ma saisie');
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(h.server.writes[0].p_rows[0].data.name, 'Ma saisie');
});

test('une sauvegarde terminée pendant la requête invalide quand même sa réponse ancienne', async t => {
  const h = await setup(t);
  h.server.readGate = deferred();
  const polling = h.poll();
  h.local = { ...h.local, rows: h.local.rows.map(r => ({ ...r, name: 'Nom sauvegardé' })) };
  h.sync.save(h.local);
  await h.sync.flush();
  h.server.readGate.resolve();
  assert.equal(await polling, null);
  assert.equal(h.local.rows[0].name, 'Nom sauvegardé');
});

test('la relève attend aussi une sauvegarde en cours', async t => {
  const h = await setup(t);
  h.local = { ...h.local, etages: { logos: 'Nouveau repère' } };
  h.server.writeGate = deferred();
  h.sync.save(h.local);
  const saving = h.sync.flush();
  assert.equal(await h.poll(), null);
  h.server.writeGate.resolve();
  await saving;
  await h.poll();
  assert.equal(h.local.etages.logos, 'Nouveau repère');
});

test('une sauvegarde en échec reste protégée et son ancien retry ne rejoue pas un état périmé', async t => {
  const h = await setup(t);
  h.local = { ...h.local, etages: { logos: 'Premier texte' } };
  h.server.failWrite = true;
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(await h.poll(), null);
  h.server.failWrite = false;
  h.local = { ...h.local, etages: { logos: 'Texte corrigé' } };
  h.sync.save(h.local);
  await h.sync.flush();
  h.server.state.etages.logos = 'Texte depuis un autre appareil';
  await h.poll();
  t.mock.timers.tick(5000);
  await h.sync.flush();
  assert.equal(h.server.writes.length, 2);
  assert.equal(h.local.etages.logos, 'Texte depuis un autre appareil');
});

test('une réponse incomplète ne supprime pas les données locales', async t => {
  const h = await setup(t);
  const before = h.local;
  h.server.state = {};
  await assert.rejects(h.poll(), /incomplet/);
  assert.equal(h.local, before);
});

// Exécuter uniquement la logique de l’interface, sans DOM ni navigateur.
const html = await readFile(new URL('../Cosmos.dc.html', import.meta.url), 'utf8');
const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1]
  .replaceAll("import('./cosmos-core.js')", `import(${JSON.stringify(new URL('../cosmos-core.js', import.meta.url).href)})`)
  .replaceAll("import('./cosmos-sync.js')", `import(${JSON.stringify(new URL('../cosmos-sync.js', import.meta.url).href)})`);
function application(document = { getElementById: () => null }) {
  class Logic {
    props = {};
    setState(update, cb) { this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) }; cb?.(); }
  }
  const { Component, bindCore } = new Function('DCLogic', 'document', 'location', script + '\nreturn { Component, bindCore };')(Logic, document, { hash: '#/cosmos', origin: 'http://localhost:8123' });
  bindCore(core);
  const app = new Component();
  app.messages = [];
  app.flash = message => app.messages.push(message);
  app.syncHash = () => {};
  return app;
}

test('le volet supprimé se ferme, le filtre retiré se réinitialise et les données ne repartent pas en sauvegarde', async t => {
  const h = await setup(t);
  const app = application();
  app.sync = h.sync;
  app.state = { ...app.state, ...h.local, ready: true, selected: 'mc-a', cosmosFilter: 'TRAVAIL', cosmosMenu: 'TRAVAIL' };
  h.server.state = { ...snapshot([]), cosmos: [], etageDe: {}, etages: {} };
  await app.pollDb();
  assert.equal(app.state.selected, null);
  assert.equal(app.state.cosmosFilter, 'Tous');
  assert.equal(app.state.cosmosMenu, null);
  assert.deepEqual(app.state.rows, []);
  assert.equal(app.state.ready, true);
  app.componentDidUpdate();
  await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
});

test('une édition reste intacte puis la suppression distante arrive une fois le volet refermé', async t => {
  const h = await setup(t);
  const app = application();
  app.sync = h.sync;
  app.state = { ...app.state, ...h.local, ready: true, selected: 'mc-a', editing: true };
  h.server.state.miniCosmos = [];
  await app.pollDb();
  assert.equal(h.server.reads, 1);
  assert.equal(app.state.rows.length, 2);
  app.setState({ editing: false });
  await app.pollDb();
  assert.equal(app.state.rows.length, 0);
  assert.equal(app.state.selected, null);
});

test('une édition commencée ou une déconnexion pendant la requête empêche son application', async t => {
  const h = await setup(t);
  const app = application();
  app.sync = h.sync;
  app.state = { ...app.state, ...h.local, ready: true };
  for (const busy of [{ editing: true }, { ready: false }, { showMiniModal: true }]) {
    app.setState({ editing: false, ready: true, showMiniModal: false });
    h.server.readGate = deferred();
    const polling = app.pollDb();
    app.setState(busy);
    h.server.state.miniCosmos = [];
    h.server.readGate.resolve();
    await polling;
    assert.equal(app.state.rows.length, 2);
  }
});

test('minuit actualise le statut, la projection, les mandats et les nouveaux formulaires', t => {
  t.after(() => core.refreshToday());
  const reference = core.TODAY;
  core.refreshToday(new Date('2026-09-06T23:59:59+02:00'));
  const row = { ...mini('mc-date'), startAt: '2026-09-07', cloture: '2026-09-07' };
  assert.equal(core.statutOf(row), 'Pause');
  assert.equal(core.projectionOf(row).days, 1);
  const night = new Date('2026-09-07T00:00:01+02:00');
  assert.equal(core.refreshToday(night), true);
  assert.equal(core.TODAY, reference);
  assert.equal(core.refreshToday(night), false);
  assert.equal(core.statutOf(row), 'Actif');
  assert.equal(core.projectionOf(row).zone, 'jourj');
  assert.equal(core.freshForm().startAt, '2026-09-07');
  assert.equal(core.daysAgo(1), '2026-09-06');
  assert.equal(core.mandatDepuis('2025-09-07'), 'A:2027-09-07');
  core.refreshToday(new Date('2026-09-08T12:00:00+02:00'));
  assert.equal(core.projectionOf(row).zone, 'retard');
});

test('le tick actualise aussi la date en mode local et après une longue veille', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-26T08:00:00+01:00').getTime() });
  t.after(() => { t.mock.timers.reset(); core.refreshToday(); });
  core.refreshToday(new Date('2026-10-24T23:59:59+02:00'));
  const app = application();
  app.state.ready = true;
  app.tick();
  assert.equal(core.daysAgo(0), '2026-10-26');
  assert.equal(core.projectionOf({ ...mini('mc-sas'), sas: 'Test', sasUntil: '2026-10-25' }).zone, 'retard');
  assert.match(app.state.clock, /26/);
});

test('le timer et le retour sur l’onglet sont branchés même sans Supabase', { timeout: 2000 }, async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval', 'setTimeout'], now: new Date('2026-09-06T23:59:45+02:00').getTime() });
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }));
  const handlers = new Map();
  const doc = { visibilityState: 'hidden', addEventListener: (name, handler) => handlers.set(name, handler), removeEventListener: name => handlers.delete(name) };
  const app = application(doc);
  const booted = deferred();
  const bootLocal = app.bootLocal.bind(app);
  app.bootLocal = () => { bootLocal(); booted.resolve(); };
  t.after(() => {
    app.componentWillUnmount();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    t.mock.timers.reset(); core.refreshToday();
  });
  app.componentDidMount();
  await booted.promise;
  assert.equal(app.sync, undefined);
  assert.equal(core.daysAgo(0), '2026-09-06');
  t.mock.timers.tick(30000);
  assert.equal(core.daysAgo(0), '2026-09-07');
  t.mock.timers.setTime(new Date('2026-09-09T08:00:00+02:00').getTime());
  handlers.get('visibilitychange')();
  assert.equal(core.daysAgo(0), '2026-09-07', 'un onglet masqué ne lance pas de relève');
  doc.visibilityState = 'visible';
  handlers.get('visibilitychange')();
  assert.equal(core.daysAgo(0), '2026-09-09');
  app.componentWillUnmount();
  assert.equal(handlers.has('visibilitychange'), false);
});
