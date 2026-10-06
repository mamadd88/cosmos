import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { createControllerClass } from '../app/state/CosmosController.js';
import { CosmosContext } from '../app/state/CosmosContext.tsx';
import JournalPage from '../app/routes/journal.tsx';
import * as core from '../cosmos-core.js';
import { createSync } from '../cosmos-sync.js';
import { valueChangeJournal } from '../cosmos-journal.js';

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
    if (name === 'charger_etat_v4') {
      server.reads++;
      const data = clone(server.state);
      if (server.readGate) await server.readGate.promise;
      return { data, error: null };
    }
    assert.equal(name, 'sync_etat_v4');
    server.writes.push(clone(args));
    if (server.writeGate) await server.writeGate.promise;
    if (server.failWrite) return { error: { message: 'Réseau indisponible' } };
    if (args.p_replace) server.state = snapshot([]);
    if (args.p_cosmos) server.state.cosmos = clone(args.p_cosmos);
    for (const [arg, key] of [['p_etage_de', 'etageDe'], ['p_etages', 'etages'], ['p_titres_etages', 'titresEtages'], ['p_titres_de', 'titresDe'], ['p_sections', 'sections'], ['p_section_de', 'sectionDe']]) {
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
  const sync = await createSync({ config: { supabaseUrl: 'https://example.invalid', supabaseKey: 'test' }, clientFactory: () => db });
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
  h.server.state.journal = [{ id: 'j-new', t: '2026-09-06T10:01:00Z', type: 'modification', author: 'Agent', detail: 'Valeur actuelle modifiée', changes: [{field:'Valeur actuelle',before:'1',after:'2'}] }];
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

// Exécuter le contrôleur utilisé par React, sans navigateur ni ancien runtime HTML.
function application(document = { getElementById: () => null }) {
  const Controller = createControllerClass({ document, location: { pathname: '/cosmos', origin: 'http://localhost:8123' } });
  const app = new Controller();
  app.messages = [];
  app.flash = message => app.messages.push(message);
  app.syncHash = () => {};
  app.importRef = { current: null };
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

function editableApp(rows = [mini('mc-a')]) {
  const app = application();
  app.state = { ...app.state, cosmos: ['TRAVAIL'], etageDe: { TRAVAIL: 'ethos' }, titresDe: { TRAVAIL: ['PROJETS'] },
    rows: rows.map(x => ({ objectif: 'Objectif initial', entropie: 'Risque', reponse: 'Réponse', ...x })), ready: true, form: core.freshForm() };
  return app;
}
const input = value => ({ target: { value } });

test('valider un renommage identique garde les titres et l’étage', () => {
  const app = editableApp();
  app.renderVals().groups[0].startEdit({ stopPropagation() {} });
  app.renderVals().groups[0].saveEdit();
  assert.deepEqual(app.state.titresDe, { TRAVAIL: ['PROJETS'] });
  assert.deepEqual(app.state.etageDe, { TRAVAIL: 'ethos' });
  assert.equal(app.state.journal.length, 0);
});

test('renommer réellement déplace les titres, l’étage et les mini-cosmos', () => {
  const app = editableApp();
  app.setState({ editCosmos: 'TRAVAIL', editCosmosName: 'PROJETS' });
  app.renderVals().groups[0].saveEdit();
  assert.deepEqual(app.state.cosmos, ['PROJETS']);
  assert.deepEqual(app.state.titresDe, { PROJETS: ['PROJETS'] });
  assert.deepEqual(app.state.etageDe, { PROJETS: 'ethos' });
  assert.equal(app.state.rows[0].cosmos, 'PROJETS');
});

test('le tri clôture compare les dates réelles, dates précises et mandats compris', () => {
  const app = editableApp([mini('mc-late'), { ...mini('mc-middle'), cloture: 'A:2026-11-01' }, { ...mini('mc-early'), cloture: 'M:2026-10' }]);
  const ids = () => app.renderVals().groups[0].rows.filter(x => x.isRow).map(x => x.id);
  app.renderVals().columns.find(x => x.key === 'cloture').onClick();
  assert.deepEqual(ids(), ['mc-early', 'mc-middle', 'mc-late']);
  app.renderVals().columns.find(x => x.key === 'cloture').onClick();
  assert.deepEqual(ids(), ['mc-late', 'mc-middle', 'mc-early']);
});

for (const exit of ['close', 'finish', 'navigate']) test(`une édition valide est enregistrée avec son journal (${exit})`, () => {
  const app = editableApp(); app.setState({ selected: 'mc-a' });
  app.renderVals().detail.toggleEdit();
  app.renderVals().detail.edit.objectif(input('Objectif modifié'));
  app.renderVals().detail.edit.actuel(input('Valeur modifiée'));
  assert.equal(app.state.rows[0].objectif, 'Objectif initial');
  assert.equal(app.serialize().miniCosmos[0].objectif, 'Objectif initial');
  if (exit === 'close') app.renderVals().closeDetail();
  else if (exit === 'navigate') app.renderVals().tabJournal.onClick();
  else app.renderVals().detail.toggleEdit();
  assert.equal(app.state.rows[0].objectif, 'Objectif modifié');
  assert.equal(app.state.journal.length, 1);
  assert.deepEqual(app.state.journal[0].changes, [{ field: 'Valeur actuelle', before: '', after: 'Valeur modifiée' }]);
  app.renderVals().closeDetail();
  assert.equal(app.state.journal.length, 1);
});

for (const [field, value] of [['name', ''], ['entropie', '  '], ['reponse', ''], ['startAt', '2027-01-01'], ['cloture', '2026-02-30'], ['alertDays', '-1']]) {
  test(`une édition invalide ne se sauvegarde pas : ${field}`, () => {
    const app = editableApp(); app.setState({ selected: 'mc-a' }); app.beginEdit('mc-a');
    const before = clone(app.state.rows);
    app.renderVals().detail.edit[field](input(value)); app.renderVals().closeDetail();
    assert.equal(app.state.selected, 'mc-a'); assert.equal(app.state.editing, true); assert.ok(app.state.editError);
    assert.deepEqual(app.state.rows, before); assert.equal(app.state.journal.length, 0);
    app.renderVals().detail.cancelEdit(); assert.equal(app.state.editing, false);
  });
}

test('édition : les doublons et les dates de SAS hors période sont refusés', () => {
  const app = editableApp([mini('mc-a'), mini('mc-b')]); app.setState({ selected: 'mc-a' }); app.beginEdit('mc-a');
  app.renderVals().detail.edit.name(input('mc-b')); assert.equal(app.finishEdit(), false);
  app.renderVals().detail.edit.name(input('mc-a'));
  app.renderVals().detail.edit.sas(input('14 jours'));
  app.renderVals().detail.edit.sasUntil(input('2027-01-01')); assert.equal(app.finishEdit(), false);
  app.renderVals().detail.edit.sasUntil(input('2026-09-15')); assert.equal(app.finishEdit(), true);
});

test('annuler restaure aussi les étapes et les actions de statut du brouillon', () => {
  const app = editableApp(); app.setState({ selected: 'mc-a' }); app.beginEdit('mc-a');
  app.renderVals().detail.addStep(); app.renderVals().detail.togglePause();
  app.renderVals().detail.cancelEdit();
  assert.deepEqual(app.state.rows[0].actions, []); assert.equal(app.state.rows[0].pause, false); assert.equal(app.state.journal.length, 0);
});

test('clôturer et réouvrir conserve le mandat, les dates et le statut calculé', () => {
  const app = editableApp([{ ...mini('mc-a'), cloture: 'A:2027-09-06', pause: true }]); app.setState({ selected: 'mc-a' });
  app.renderVals().detail.closeIt();
  assert.equal(app.state.rows[0].cloture, 'A:2027-09-06'); assert.equal(app.state.rows[0].closedAt, core.daysAgo(0));
  assert.equal(app.renderVals().detail.cloture, core.fmtFR(core.daysAgo(0)));
  assert.equal(core.echeanceEffective(app.state.rows[0]).iso, core.daysAgo(0));
  app.renderVals().detail.toggleClose();
  assert.equal(app.state.rows[0].closedAt, undefined); assert.equal(app.state.rows[0].cloture, 'A:2027-09-06');
  assert.equal(core.statutOf(app.state.rows[0]), 'Pause');
  assert.equal(app.state.rows[0].history, undefined);
  assert.equal(app.state.journal.length, 0);
});

test('Échap pendant le renommage ne renomme pas le cosmos au blur suivant', () => {
  const app=editableApp(); app.setState({editCosmos:'TRAVAIL',editCosmosName:'RENOMMÉ'});
  const g=app.renderVals().groups[0]; g.editKey({key:'Escape'}); g.saveEdit();
  assert.deepEqual(app.state.cosmos,['TRAVAIL']); assert.deepEqual(app.state.titresDe,{TRAVAIL:['PROJETS']});
});
test('le rangement sous un titre fait partie du brouillon annulable', () => {
  const app=editableApp(); app.setState({selected:'mc-a'}); app.beginEdit('mc-a');
  app.rangerSous('mc-a','PROJETS'); assert.equal(app.state.rows[0].titre,undefined); assert.equal(app.state.editDraft.titre,'PROJETS');
  app.rangerSous('mc-a',''); assert.equal(app.state.editDraft.titre,undefined);
  app.rangerSous('mc-a','PROJETS'); app.cancelMiniEdit();
  assert.equal(app.state.rows[0].titre,undefined); assert.equal(app.state.journal.length,0);
});

test('résoudre un conflit exporte la copie locale avant de charger la base, même vide', async () => {
  const app=editableApp(); app.setState({syncConflict:'Conflit'}); const calls=[];
  app.exportJson=async () => { calls.push(['export',app.serialize().miniCosmos.length]); };
  app.sync={reloadAfterConflict:async()=>{calls.push(['load']);return {cosmos:[],rows:[],etageDe:{},etages:{},titresDe:{},journal:[],journalArchived:0,propositions:[]};},prime:()=>{calls.push(['prime']);}};
  await app.resolveSyncConflict();
  assert.deepEqual(calls,[['export',1],['load'],['prime']]); assert.deepEqual(app.state.rows,[]); assert.equal(app.state.syncConflict,'');
});
test('une erreur de rechargement conserve la copie locale et le message de conflit', async () => {
  const app=editableApp(); app.setState({syncConflict:'Conflit'});
  app.exportJson=async()=>{}; app.sync={reloadAfterConflict:async()=>{throw new Error('Hors ligne');}};
  await app.resolveSyncConflict(); assert.equal(app.state.rows.length,1); assert.equal(app.state.syncConflict,'Conflit'); assert.equal(app.state.syncConflictBusy,false);
});

function deadlinesApp(t, rows, state = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-06T12:00:00+02:00').getTime() });
  t.after(() => { t.mock.timers.reset(); core.refreshToday(); });
  core.refreshToday();
  const app = editableApp(rows);
  app.setState({ view: 'echeances', ...state });
  return app;
}
const deadline = (id, date, patch = {}) => ({ ...mini(id), cloture: date, ...patch });

test('Échéances : changer l’année retire le mois et le trimestre précédents', t => {
  const app = deadlinesApp(t, [deadline('mc-2026', '2026-09-30'), deadline('mc-2027', '2027-09-30')]);
  app.renderVals().setMonth(input('2026-09'));
  app.renderVals().setYear(input('2027'));
  let v = app.renderVals();
  assert.equal(v.monthFilter, ''); assert.equal(v.quarterFilter, '');
  assert.deepEqual(v.echeances.map(x => x.id), ['mc-2027']);
  v.setQuarter(input('2027-Q3')); app.renderVals().setYear(input('2026'));
  v = app.renderVals(); assert.equal(v.quarterFilter, '');
  assert.deepEqual(v.echeances.map(x => x.id), ['mc-2026']);
});

test('Échéances : choisir un mois ou trimestre d’une autre année adapte l’année active', t => {
  const app = deadlinesApp(t, [deadline('mc-2026', '2026-09-30'), deadline('mc-2027', '2027-09-30')], { yearFilter: '2026' });
  app.renderVals().setMonth(input('2027-09'));
  assert.equal(app.state.yearFilter, '2027'); assert.equal(app.renderVals().echShown, 1);
  app.renderVals().setQuarter(input('2026-Q3'));
  assert.equal(app.state.yearFilter, '2026'); assert.equal(app.state.monthFilter, '');
  assert.deepEqual(app.renderVals().echeances.map(x => x.id), ['mc-2026']);
  app.renderVals().setYear(input(''));
  assert.equal(app.renderVals().echShown, 2); assert.equal(app.state.quarterFilter, '');
});

test('Échéances : un mois choisi sans filtre annuel ne crée pas de filtre annuel implicite', t => {
  const app = deadlinesApp(t, [deadline('mc-a', '2026-09-30'), deadline('mc-b', '2027-09-30')]);
  app.renderVals().setMonth(input('2027-09')); assert.equal(app.renderVals().yearFilter, '');
  app.renderVals().setMonth(input('')); assert.equal(app.renderVals().echShown, 2);
});

test('Échéances : les menus incluent les années réelles anciennes et lointaines', t => {
  const app = deadlinesApp(t, [deadline('mc-old', '2019-12-31', { startAt: '2019-01-01' }), deadline('mc-far', 'A:2050-03-01')]);
  const v = app.renderVals();
  for (const year of ['2019', '2050']) {
    assert.ok(v.yearOptions.some(o => o.value === year));
    assert.ok(v.monthGroups.some(g => g.year === year));
    assert.ok(v.quarterGroups.some(g => g.year === year));
  }
  v.setYear(input('2019'));
  assert.deepEqual(app.renderVals().echeances.map(x => x.id), ['mc-old']);
});

test('Échéances : les valeurs sélectionnées restent proposées après le Nouvel An et une suppression', t => {
  const app = deadlinesApp(t, [], { yearFilter: '2026', monthFilter: '2026-12' });
  t.mock.timers.setTime(new Date('2027-01-01T12:00:00+01:00').getTime());
  let v = app.renderVals();
  assert.ok(v.yearOptions.some(o => o.value === v.yearFilter));
  assert.ok(v.monthGroups.flatMap(g => g.items).some(o => o.value === v.monthFilter));
  app.setState({ monthFilter: '', quarterFilter: '2026-Q4' }); v = app.renderVals();
  assert.ok(v.quarterGroups.flatMap(g => g.items).some(o => o.value === v.quarterFilter));
});

for (const days of [7, 30, 90]) test(`Échéances : ${days} jours inclut aujourd’hui et la borne, mais exclut le passé`, t => {
  const app = deadlinesApp(t, []);
  app.setState({ rows: [deadline('mc-late', core.daysAgo(180)), deadline('mc-yesterday', core.daysAgo(1)), deadline('mc-today', core.daysAgo(0)), deadline('mc-boundary', core.daysAgo(-days)), deadline('mc-beyond', core.daysAgo(-days - 1))] });
  app.renderVals().echTimeChips.find(c => c.label === days + ' j').onClick();
  const v = app.renderVals();
  assert.deepEqual(v.echeances.map(x => x.id), ['mc-today', 'mc-boundary']);
  assert.equal(v.echTimeChips.find(c => c.label === days + ' j').count, 2);
  v.echTimeChips.find(c => c.label === 'Tous').onClick(); assert.equal(app.renderVals().echShown, 5);
});

test('Échéances : les compteurs annoncent exactement les résultats du clic avec période, zone et recherche', t => {
  const app = deadlinesApp(t, [
    deadline('mc-priority-late', '2026-09-03'), deadline('mc-priority-today', '2026-09-06'),
    deadline('mc-priority-soon', '2026-09-10'), deadline('mc-priority-later', '2026-09-25'),
    deadline('mc-priority-month', '2026-10-05'), deadline('mc-priority-year', '2027-09-06'),
    deadline('mc-unrelated', '2026-09-10'),
  ], { yearFilter: '2026', monthFilter: '2026-09', eQuery: 'priority', timeFilter: 30, echZone: 'tension' });
  const filters = { ...app.state };
  const v = app.renderVals();
  assert.equal(v.echZoneChips.find(c => c.label === 'Retard').count, 0);
  for (const c of v.echZoneChips) {
    app.state = { ...filters }; c.onClick(); assert.equal(app.renderVals().echShown, c.count, c.label);
  }
  app.state = { ...filters };
  for (const c of app.renderVals().echTimeChips) {
    app.state = { ...filters }; c.onClick(); assert.equal(app.renderVals().echShown, c.count, c.label);
  }
});

test('Échéances : les KPI et les alertes vitales suivent les filtres actifs', t => {
  const app = deadlinesApp(t, [deadline('mc-late', '2026-09-01', { poids: 'vital' }), deadline('mc-future', 'A:2027-09-01')], { yearFilter: '2027' });
  let v = app.renderVals();
  assert.equal(v.echKpis.find(k => k.label === 'retard').value, 0);
  assert.equal(v.echKpis.find(k => k.label === 'mandats').value, 1);
  assert.equal(v.echZoneChips.find(c => c.label === 'Retard').vitalW, '0px');
  v.setEQuery(input('introuvable')); v = app.renderVals();
  assert.ok(v.echKpis.every(k => k.value === 0)); assert.ok(v.echZoneChips.every(c => c.count === 0));
});

test('Échéances : les dates futures apparaissent, les pauses manuelles et clôtures restent exclues', t => {
  const app = deadlinesApp(t, [
    deadline('mc-planned', '2026-09-09', { startAt: '2026-09-07' }),
    deadline('mc-paused', '2026-09-09', { pause: true }),
    deadline('mc-future-paused', '2026-09-09', { startAt: '2026-09-07', pause: true }),
    deadline('mc-closed', '2026-09-09', { closed: true }),
  ]);
  let v = app.renderVals(); assert.equal(v.echCount, 1);
  assert.equal(v.echeances[0].statut, 'À venir'); assert.match(v.echeances[0].statutHint, /07\/09\/2026/);
  t.mock.timers.setTime(new Date('2026-09-07T12:00:00+02:00').getTime()); v = app.renderVals();
  assert.equal(v.echeances[0].statut, 'Actif'); assert.equal(v.echCount, 1);
});

test('Échéances : tri par date effective, puis poids, et ouverture sans quitter la page', t => {
  const app = deadlinesApp(t, [
    deadline('mc-normal', '2026-09-20'), deadline('mc-vital', '2026-09-20', { poids: 'vital' }),
    deadline('mc-mandat', 'A:2026-09-15'), deadline('mc-test', '2027-01-01', { sas: 'Test', sasUntil: '2026-09-08' }),
  ]);
  app.renderVals().setYear(input('2026')); const v = app.renderVals();
  assert.deepEqual(v.echeances.map(x => x.id), ['mc-test', 'mc-mandat', 'mc-vital', 'mc-normal']);
  assert.equal(v.echeances[0].isSas, true); assert.equal(v.echeances[0].cloture, '08/09/2026');
  v.echeances[0].open(); assert.equal(app.state.selected, 'mc-test'); assert.equal(app.state.view, 'echeances');
  assert.match(v.echeances[0].openLabel, /mc-test.*TRAVAIL/);
});

test('Échéances : réinitialiser retire tous les critères, recherche comprise', t => {
  const app = deadlinesApp(t, [deadline('mc-a', '2026-09-10')], { yearFilter: '2027', monthFilter: '2027-09', timeFilter: 7, echZone: 'retard', eQuery: 'introuvable' });
  assert.equal(app.renderVals().echHasFilters, true);
  app.renderVals().resetEcheancesFilters();
  assert.equal(app.renderVals().echShown, 1); assert.equal(app.renderVals().echHasFilters, false);
});

test('Cosmos : les filtres partagés suivent les mêmes bornes de délai et de période', t => {
  const app = deadlinesApp(t, [deadline('mc-past', '2026-09-05'), deadline('mc-future', '2026-09-10')], { view: 'table', timeFilter: 7 });
  assert.deepEqual(app.renderVals().groups.flatMap(g => g.rows.filter(r => r.isRow).map(r => r.id)), ['mc-future']);
  assert.equal(app.renderVals().timeChips.find(c => c.label === '7 j').count, 1);
});

function journalApp(t, journal, rows = [], state = {}, now = '2026-09-06T12:00:00+02:00') {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(now).getTime() });
  t.after(() => { t.mock.timers.reset(); core.refreshToday(); });
  core.refreshToday();
  const app = editableApp(rows);
  app.setState({ view: 'journal', journal, ...state });
  return app;
}
const journalEntry = (id, patch = {}) => ({ id, t: '2026-09-06T10:00:00.000Z', type: 'creation', author: 'Toi', miniId: 'mc-a', mini: 'Projet', cosmos: 'TRAVAIL', detail: 'Mini-cosmos créé', ...patch });
const journalMetrics = app => Object.fromEntries(app.activityVals().jActivity.map(m => [m.label, m.value]));

test('Journal : toute une édition produit une seule variation finale de Valeur actuelle', () => {
  const app = editableApp([{ ...mini('mc-a'), actuel: '0' }]);
  app.beginEdit('mc-a');
  app.update('mc-a', { actuel: '1', objectif: 'Nouveau' });
  app.update('mc-a', { actuel: '2', pause: true }, { type: 'statut', value: 'Pause' });
  app.update('mc-a', { actions: [{ text: 'Livrer', done: true }] }, { type: 'step' });
  assert.equal(app.state.journal.length, 0);
  assert.equal(app.finishEdit(), true);
  assert.deepEqual(app.state.journal[0].changes, [{ field: 'Valeur actuelle', before: '0', after: '2' }]);
  assert.equal(app.state.journal.length, 1);
  assert.equal(app.state.rows[0].objectif, 'Nouveau');
  assert.equal(app.state.rows[0].pause, true);
  assert.equal(app.state.rows[0].actions[0].done, true);
  app.beginEdit('mc-a');
  app.update('mc-a', { actuel: '3' });
  app.update('mc-a', { actuel: '2', objectif: 'Autre objectif' });
  app.finishEdit();
  assert.equal(app.state.rows[0].objectif, 'Autre objectif');
  assert.equal(app.state.journal.length, 1);
  app.update('mc-a', { actuel: '' });
  assert.deepEqual(app.state.journal[0].changes, [{ field: 'Valeur actuelle', before: '2', after: '' }]);
  app.update('mc-a', { actuel: '' });
  assert.equal(app.state.journal.length, 2);
});

test('Journal : une édition sans Valeur actuelle et les événements accessoires ne sont pas journalisés', () => {
  const app = editableApp();
  app.beginEdit('mc-a');
  app.update('mc-a', { objectif: 'Nouveau', name: 'Renommé', titre: 'PROJETS', poids: 'vital' });
  assert.equal(app.finishEdit(), true);
  assert.equal(app.state.rows[0].name, 'Renommé');
  for (const type of ['creation', 'statut', 'etape', 'deplacement', 'suppression', 'cosmos', 'donnees', 'proposition', 'note'])
    app.logJ({ type, detail: 'Événement accessoire' });
  assert.equal(app.state.journal.length, 0);
  assert.deepEqual(app.journalFromRows(core.SEED), []);
});

test('Journal : les anciens exports conservent seulement les valeurs avant/après utiles', () => {
  const events = [
    { id: 'mixed', type: 'modification', detail: 'Objectif et étapes', changes: [
      { field: 'Objectif', before: 'ancien', after: 'nouveau' },
      { field: 'Valeur actuelle', before: '0', after: '1' },
    ] },
    { id: 'same', type: 'modification', changes: [{ field: 'Valeur actuelle', before: '1', after: '1' }] },
    { id: 'bad', type: 'modification', changes: [{ field: 'Valeur actuelle', after: '2' }] },
    { id: 'note', type: 'note', detail: 'note' },
  ];
  const app = editableApp();
  app.setState({ journal: events, journalArchive: events });
  const expected = [{ ...events[0], detail: 'Valeur actuelle modifiée', changes: [events[0].changes[1]] }];
  assert.deepEqual(app.serialize().journal, expected);
  assert.deepEqual(app.serialize().journalArchive, expected);
  assert.deepEqual(valueChangeJournal(events), expected);
  assert.equal(events[0].changes.length, 2);
});

test('Journal : un événement ignoré ne provoque ni requête de sauvegarde ni blocage de la relève', async t => {
  const h = await setup(t);
  h.local.journal = [{ id: 'old-note', type: 'note', detail: 'Ancien onglet' }];
  h.sync.save(h.local); await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
  h.server.state.miniCosmos[0].data.actuel = 'Valeur distante';
  await h.poll();
  assert.equal(h.local.rows[0].actuel, 'Valeur distante');
  assert.deepEqual(h.local.journal, []);
});

test('Journal : une proposition IA sauvegarde tout mais journalise uniquement la valeur actuelle', () => {
  const app = editableApp([{ ...mini('mc-a'), actions: [{ text: 'Étape initiale', done: true }] }]);
  const after = 'Objectif détaillé '.repeat(20);
  assert.equal(app.applyPatch(app.state.rows[0], { objectif: after, actuel: after, etapes: ['Nouvelle étape'], poids: 'vital' }, 'Proposition de Nova acceptée'), true);
  const entry = app.state.journal[0];
  assert.equal(entry.miniId, 'mc-a');
  assert.deepEqual(entry.changes, [{ field: 'Valeur actuelle', before: '', after }]);
  assert.equal(app.state.rows[0].objectif, after);
  assert.deepEqual(app.state.rows[0].actions.map(a => a.text), ['Étape initiale', 'Nouvelle étape']);
  assert.equal(app.state.rows[0].poids, 'vital');
  assert.equal(app.state.rows[0].actions[0].done, true);
  assert.deepEqual(app.serialize().journal[0].changes, entry.changes);
  assert.equal(app.applyPatch(app.state.rows[0], { objectif: after, actuel: after, etapes: ['Nouvelle étape'], poids: 'vital' }, 'Identique'), false);
  assert.equal(app.state.journal.length, 1);
});

test('Journal : le brouillon IA ne publie ses détails qu’à validation et peut être annulé', () => {
  const app = editableApp();
  app.beginEdit('mc-a');
  app.applyPatch(app.state.editDraft, { objectif: 'Objectif proposé', actuel: 'Valeur proposée' }, 'Proposition IA appliquée');
  assert.equal(app.state.journal.length, 0);
  assert.equal(app.state.rows[0].objectif, 'Objectif initial');
  app.cancelMiniEdit();
  assert.equal(app.state.journal.length, 0);
  app.beginEdit('mc-a');
  app.applyPatch(app.state.editDraft, { objectif: 'Objectif proposé', actuel: 'Valeur proposée' }, 'Proposition IA appliquée');
  assert.equal(app.finishEdit(), true);
  const entry = app.state.journal[0];
  assert.deepEqual(entry.changes, [{ field: 'Valeur actuelle', before: '', after: 'Valeur proposée' }]);
});

test('Journal : les détails avant/après traversent la sauvegarde et le rechargement', async t => {
  const h = await setup(t);
  const app = editableApp(h.local.rows);
  app.applyPatch(app.state.rows[0], { objectif: 'Objectif synchronisé', actuel: 'Valeur synchronisée' }, 'Proposition IA appliquée');
  h.sync.save(app.state); await h.sync.flush();
  assert.deepEqual(h.server.writes[0].p_journal[0].changes, app.state.journal[0].changes);
  const loaded = await h.sync.load();
  assert.deepEqual(loaded.journal[0].changes, app.state.journal[0].changes);
});

test('Journal : supprimer une fiche conserve son historique sans ajouter un événement', t => {
  const entries = [journalEntry('j-created'), journalEntry('j-closed', { type: 'statut', detail: 'Statut → Clôturé (date effective 2026-09-06)' }), journalEntry('j-step', { type: 'etape', detail: 'Étape cochée : Livrer' })];
  const app = journalApp(t, entries, [{ ...mini('mc-a'), createdAt: '2026-09-06', history: [{ t: '2026-09-06', type: 'created' }] }], { selected: 'mc-a', jPeriod: 7 });
  const before = journalMetrics(app), rhythm = app.activityVals().jStepsPerWeek;
  app.renderVals().doDeleteMini();
  assert.equal(app.state.rows.length, 0);
  assert.deepEqual(journalMetrics(app), before);
  assert.deepEqual(app.state.journal, entries);
  assert.equal(before['créés'], 1); assert.equal(before['clôturés'], 1); assert.equal(before['étapes cochées'], 1);
  assert.equal(app.activityVals().jStepsPerWeek, rhythm);
  assert.equal(app.state.journal[0].miniId, 'mc-a');
});

test('Journal : les étapes décochées et réouvertures ne gonflent pas les accomplissements', t => {
  const app = journalApp(t, [
    journalEntry('a', { type: 'etape', detail: 'Étape cochée : Préparer' }),
    journalEntry('b', { type: 'etape', detail: 'Étape décochée : Préparer' }),
    journalEntry('c', { type: 'etape', detail: 'Étape cochée : Préparer' }),
    journalEntry('d', { type: 'statut', detail: 'Statut → Clôturé' }),
    journalEntry('e', { type: 'statut', detail: 'Réouvert' }),
    journalEntry('f', { type: 'statut', detail: 'SAS franchi → admis dans le cosmos' }),
    journalEntry('g', { type: 'statut', detail: 'SAS rouvert' }),
  ]);
  assert.equal(journalMetrics(app)['étapes cochées'], 2);
  assert.equal(journalMetrics(app)['clôturés'], 1);
  assert.equal(journalMetrics(app)['admis'], 1);
});

for (const now of ['2026-04-01T12:00:00+02:00', '2026-10-28T12:00:00+01:00']) {
  for (const period of [7, 30, 90]) test(`Journal : bornes calendaires et comparaison sur ${period} jours autour de ${now.slice(0, 10)}`, t => {
    const app = journalApp(t, [], [], { jPeriod: period }, now);
    const from = new Date(core.daysAgo(period - 1) + 'T00:00:00').getTime();
    const prevFrom = new Date(core.daysAgo(2 * period - 1) + 'T00:00:00').getTime();
    const end = new Date(core.daysAgo(-1) + 'T00:00:00').getTime();
    app.setState({ journal: [
      journalEntry('before-previous', { t: new Date(prevFrom - 1).toISOString() }),
      journalEntry('previous', { t: new Date(prevFrom).toISOString() }),
      journalEntry('before-start', { t: new Date(from - 1).toISOString() }),
      journalEntry('start', { t: new Date(from).toISOString() }),
      journalEntry('last', { t: new Date(end - 1).toISOString() }),
      journalEntry('tomorrow', { t: new Date(end).toISOString() }),
    ] });
    const values = app.journalVals();
    assert.deepEqual(values.jGroups.flatMap(g => g.items.map(e => e.id)), ['last', 'start']);
    const created = app.activityVals().jActivity.find(m => m.label === 'créés');
    assert.equal(created.value, 2); assert.equal(created.deltaLabel, '0 vs période préc.');
  });
}

test('Journal : une admission après minuit appartient au même jour dans la liste et les compteurs', t => {
  const app = journalApp(t, [journalEntry('midnight', { t: '2026-08-30T22:30:00.000Z', type: 'statut', detail: 'SAS franchi → admis dans le cosmos' })], [], { jPeriod: 7 });
  const values = app.journalVals();
  assert.equal(values.jGroups[0].day, '2026-08-31'); assert.equal(values.jGroups[0].items[0].time, '00:30');
  assert.equal(values.jShown, 1); assert.equal(journalMetrics(app)['admis'], 1);
});

test('Journal : minuit actualise la période et ses compteurs sans rechargement', t => {
  const app = journalApp(t, [journalEntry('boundary', { t: '2026-08-31T00:30:00+02:00' })], [], { jPeriod: 7 }, '2026-09-06T23:59:00+02:00');
  assert.equal(app.renderVals().jShown, 1);
  t.mock.timers.setTime(new Date('2026-09-07T00:01:00+02:00').getTime());
  app.tick();
  assert.equal(app.renderVals().jShown, 0); assert.equal(journalMetrics(app)['créés'], 0);
});

test('Journal : chaque compteur annonce le résultat du clic avec les autres filtres', t => {
  const app = journalApp(t, [
    journalEntry('a'), journalEntry('b', { author: 'Nova' }),
    journalEntry('c', { author: 'Nova', type: 'note', detail: 'Projet observé' }),
    journalEntry('d', { author: 'Nova', mini: 'Autre', detail: 'Autre sujet' }),
    journalEntry('e', { author: 'Nova', t: '2026-07-01T10:00:00Z' }),
  ], [], { jPeriod: 7, jAuthor: 'Nova', jType: 'creation', jQuery: 'projet' });
  assert.equal(app.journalVals().jShown, 1); assert.equal(journalMetrics(app)['créés'], 1);
  const initial = { ...app.state };
  for (const category of ['jTypeChips', 'jAuthorChips']) {
    for (const chip of app.journalVals()[category]) {
      chip.onClick();
      assert.equal(app.journalVals().jShown, chip.count, category + ': ' + chip.label);
      app.state = { ...initial };
    }
  }
  assert.equal(app.journalVals().jTypeChips.find(c => c.label === 'Tous').count, 2);
});

test('Journal : les auteurs absents restent filtrables et tous les critères peuvent être réinitialisés', t => {
  const app = journalApp(t, [journalEntry('missing', { author: undefined })], [], { jPeriod: 7, jQuery: 'Projet', jPage: 5 });
  const anonymous = app.journalVals().jAuthorChips.find(c => c.label === '—');
  assert.equal(anonymous.count, 1); anonymous.onClick(); assert.equal(app.journalVals().jShown, 1);
  app.setState({ jType: 'note' }); assert.equal(app.journalVals().jShown, 0);
  app.journalVals().resetJournalFilters();
  assert.equal(app.journalVals().jHasFilters, false); assert.equal(app.journalVals().jShown, 1); assert.equal(app.state.jPage, 0);
});

test('Journal : les noms réutilisés et les entrées sans identifiant ne relient jamais une autre fiche', t => {
  const app = journalApp(t, [journalEntry('deleted', { miniId: 'mc-deleted' }), journalEntry('legacy', { miniId: undefined }), journalEntry('current', { miniId: 'mc-new' })], [{ ...mini('mc-new'), name: 'Projet' }]);
  const items = app.journalVals().jGroups[0].items;
  for (const id of ['deleted', 'legacy']) {
    const entry = items.find(e => e.id === id);
    assert.equal(entry.linkable, false); assert.equal(entry.unlinked, true); entry.openMini(); assert.equal(app.state.selected, null);
  }
  const current = items.find(e => e.id === 'current');
  assert.equal(current.linkable, true); assert.equal(current.openLabel, 'Ouvrir Projet — TRAVAIL');
  current.openMini(); assert.equal(app.state.selected, 'mc-new'); assert.equal(app.state.view, 'table');
});

test('Journal : un renommage de fiche garde le lien de ses anciennes entrées', t => {
  const app = journalApp(t, [journalEntry('old-name')], [{ ...mini('mc-a'), name: 'Nouveau nom', cosmos: 'FAMILLE' }]);
  const entry = app.journalVals().jGroups[0].items[0];
  assert.equal(entry.mini, 'Projet'); entry.openMini(); assert.equal(app.state.selected, 'mc-a');
});

test('Journal : les valeurs complètes et les textes des étapes sont affichables et recherchables', t => {
  const before = 'Ancien texte '.repeat(20) + 'valeur initiale unique';
  const after = 'Nouveau texte '.repeat(20) + 'valeur finale unique';
  const app = journalApp(t, [journalEntry('change', { type: 'modification', detail: 'Modification par l’agent : Objectif', changes: [{ field: 'Objectif', before, after }, { field: 'Étapes', before: '', after: 'Étape ajoutée' }] })]);
  const item = app.journalVals().jGroups[0].items[0];
  assert.equal(item.hasChanges, true); assert.deepEqual(item.changeLines[0], { field: 'Objectif', before, after });
  assert.equal(item.changeLines[1].before, '—');
  for (const query of ['valeur initiale unique', 'valeur finale unique', 'Étape ajoutée']) {
    app.journalVals().setJQuery(input(query)); assert.equal(app.journalVals().jShown, 1);
  }
});

test('Journal : modifier une étape sauvegarde le texte sans événement', () => {
  const app = editableApp([{ ...mini('mc-a'), actions: [{ text: 'Avant', done: false }] }]);
  app.beginEdit('mc-a');
  app.update('mc-a', { actions: [{ text: 'Après', done: false }] });
  assert.equal(app.finishEdit(), true);
  assert.equal(app.state.rows[0].actions[0].text, 'Après');
  assert.equal(app.state.journal.length, 0);
});

test('Journal : le tri temporel et la pagination restent corrects avec des fuseaux et un retrait distant', t => {
  const entries = Array.from({ length: 105 }, (_, i) => journalEntry('j-' + i, { t: new Date(Date.parse('2026-09-06T10:00:00Z') + i * 60000).toISOString() }));
  entries[104].t = '2026-09-06T13:44:00+02:00';
  const app = journalApp(t, entries);
  const seen = [];
  for (let i = 0; i < 3; i++) { const v = app.journalVals(); seen.push(...v.jGroups.flatMap(g => g.items.map(e => e.id))); v.jNext(); }
  assert.equal(seen[0], 'j-104'); assert.equal(new Set(seen).size, 105); assert.equal(app.journalVals().jNextDisabled, true);
  app.setState({ journal: entries.slice(0, 1) });
  assert.equal(app.journalVals().jPageLabel, 'Page 1 / 1'); assert.equal(app.journalVals().jPrevDisabled, true);
});

test('Journal : Tout compte le journal vivant sans recomposer les événements depuis les fiches ou les archives', t => {
  const app = journalApp(t, [journalEntry('live')], [{ ...mini('mc-a'), history: [{ type: 'created', t: '2020-01-01' }] }], { journalArchive: [journalEntry('old', { t: '2020-01-01T10:00:00Z' })] });
  assert.equal(journalMetrics(app)['créés'], 1);
  assert.equal(app.activityVals().jPeriodLabel, 'journal des 12 derniers mois');
});

test('Journal : les commandes de fiche et de détails utilisent des contrôles HTML natifs accessibles au clavier', t => {
  const app = journalApp(t, [journalEntry('linked', { changes: [{field:'Objectif',before:'Avant',after:'Après'}] }), journalEntry('unlinked', {miniId:'removed'})], [mini('mc-a')]);
  app.setState({view:'journal'});
  const markup = renderToStaticMarkup(createElement(StaticRouter, {location:'/journal'}, createElement(CosmosContext.Provider, {value:{controller:app,values:app.renderVals()}}, createElement(JournalPage))));
  const miniButton = markup.match(/<button\b[^>]*class="journal-mini"[^>]*>/)[0];
  assert.match(miniButton, /type="button"/); assert.match(miniButton, /aria-label="[^"]+"/);
  assert.match(markup, /<button[^>]*class="journal-mini"[^>]*disabled=""/);
  assert.match(markup, /<details\b[^>]*class="journal-changes"/); assert.match(markup, /<summary\b/);
});

test('la relève synchronise les séparations et leur suppression sans écrire ni masquer une édition', async t => {
  const h = await setup(t);
  h.server.state.sections = [{ id: 'sec-a', name: 'Projets', etage: 'logos' }];
  h.server.state.sectionDe = { TRAVAIL: 'sec-a' };
  await h.poll();
  assert.deepEqual(h.local.sections, h.server.state.sections);
  assert.deepEqual(h.local.sectionDe, h.server.state.sectionDe);
  h.sync.save(h.local); await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
  h.server.state.sections = []; h.server.state.sectionDe = {};
  await h.poll();
  assert.deepEqual(h.local.sections, []); assert.deepEqual(h.local.sectionDe, {});
  h.sync.save(h.local); await h.sync.flush();
  assert.equal(h.server.writes.length, 0);
});

test('une séparation vide se sauvegarde seule et ne déclenche pas les données d’exemple au chargement', async t => {
  const h = await setup(t, { ...snapshot([]), cosmos: [], etageDe: {}, etages: {} });
  h.local = { ...h.local, sections: [{ id: 'sec-empty', name: 'Vide', etage: 'logos' }] };
  h.sync.save(h.local); await h.sync.flush();
  assert.equal(h.server.writes.length, 1);
  assert.deepEqual(h.server.writes[0].p_sections, h.local.sections);
  assert.deepEqual(h.server.writes[0].p_rows, []);
  assert.deepEqual(h.server.writes[0].p_journal, []);
  assert.equal((await h.sync.load()).empty, false);
});

test('création rapide : migration et validation gardent les champs vides seulement pour les fiches à compléter', () => {
  const draft = { id: 'quick', cosmos: 'TRAVAIL', name: 'Idée', draft: true, pause: true, actions: [], createdAt: '2026-09-08', startAt: '', cloture: '', entropie: '', reponse: '' };
  const loaded = core.migrate([draft])[0];
  assert.equal(loaded.cloture, ''); assert.equal(loaded.startAt, '');
  assert.equal(core.startOf(loaded), null);
  assert.equal(core.validateMini(loaded), ''); assert.equal(core.statutOf(loaded), 'Pause');
  assert.equal(core.echeanceEffective(loaded).iso, null);
  assert.equal(core.isMandat(loaded.cloture), false);
  assert.ok(core.validateMini({ ...loaded, draft: false }));
  assert.ok(core.validateMini({ ...loaded, pause: false }));
  assert.ok(core.validateMini({ ...loaded, startAt: 'invalide' }));
  assert.ok(core.validateMini({ ...loaded, startAt: '2026-02-30' }));
  assert.ok(core.validateMini({ ...loaded, cloture: 'invalide' }));
  assert.ok(core.validateMini({ ...loaded, startAt: '2026-09-08', cloture: '2026-09-07' }));
  assert.ok(core.isMandat(core.migrate([{ ...draft, draft: false }])[0].cloture), 'les anciennes migrations restent compatibles');
});

test('création rapide : la relève et les exports ne créent ni mandat ni événement', async t => {
  const h = await setup(t);
  const draft = { ...mini('quick'), draft: true, pause: true, startAt: '', cloture: '', createdAt: '2026-09-08', entropie: '', reponse: '' };
  h.server.state.miniCosmos.push({ id: draft.id, data: draft, position: 2 });
  await h.poll();
  assert.equal(h.local.rows.at(-1).cloture, '');
  h.sync.save(h.local); await h.sync.flush(); assert.equal(h.server.writes.length, 0);
  const app = editableApp(h.local.rows);
  const exported = app.serialize();
  assert.equal(exported.miniCosmos.at(-1).draft, true);
  assert.equal(core.migrate(JSON.parse(JSON.stringify(exported)).miniCosmos).at(-1).cloture, '');
  app.setState({ view: 'echeances' });
  assert.ok(!app.echeancesVals().echeances.some(x => x.id === 'quick'));
});

test('création rapide : suppression du parent et duplication gardent un état cohérent', () => {
  const app = editableApp();
  app.setQuickName('TRAVAIL', 'À préciser'); assert.equal(app.quickCreate('TRAVAIL'), true);
  const id = app.state.rows.at(-1).id;
  app.setState({ selected: id }); app.renderVals().detail.duplicate();
  const copy = app.state.rows.at(-1);
  assert.equal(copy.draft, true); assert.equal(copy.pause, true); assert.equal(copy.cloture, ''); assert.equal(copy.startAt, '');
  app.cancelMiniEdit();
  app.setState({ selected: id });
  app.update(id, { sas: 'Essai prévu', sasUntil: '2026-10-08' });
  app.renderVals().detail.duplicate();
  assert.equal(app.state.editDraft.sasUntil, '2026-10-08', 'une date de test déjà choisie est conservée');
  app.cancelMiniEdit(); app.setQuickName('TRAVAIL', 'Saisie non validée');
  app.setState({ cosmos: [], rows: [] });
  assert.deepEqual(app.state.quickDrafts, {});
  assert.equal(app.quickCreate('TRAVAIL'), false);
  assert.equal(app.state.rows.length, 0);
});

test('les titres des espaces se synchronisent seuls, puis se récupèrent sans réécriture au rafraîchissement', async t => {
  const h = await setup(t);
  h.local = { ...h.local, titresEtages: { logos: 'A'.repeat(300) } };
  h.sync.save(h.local);
  await h.sync.flush();
  assert.equal(h.server.writes.length, 1);
  const payload = h.server.writes[0];
  assert.deepEqual(payload.p_titres_etages, { logos: 'A'.repeat(300) });
  assert.deepEqual(payload.p_rows, []);
  assert.deepEqual(payload.p_journal, []);
  assert.equal(payload.p_etages, null, 'les repères existants restent distincts des titres');
  assert.deepEqual(payload.p_expected.titresEtages, {});
  h.server.state.titresEtages = { logos: 'B'.repeat(300), ethos: 'MES VERTUS' };
  await h.poll();
  assert.deepEqual(h.local.titresEtages, h.server.state.titresEtages);
  h.sync.save(h.local); await h.sync.flush();
  assert.equal(h.server.writes.length, 1);
  h.server.state.titresEtages = {};
  await h.poll();
  assert.deepEqual(h.local.titresEtages, {});
});
