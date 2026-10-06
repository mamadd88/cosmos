import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// DOM simulé : interactions et routage uniquement, aucun navigateur ni test visuel.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:8123/cosmos' });
for (const key of [
  'window',
  'document',
  'location',
  'history',
  'localStorage',
  'HTMLElement',
  'Node',
  'MutationObserver',
  'navigator',
])
  Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// JSDOM ne gère pas la couche modale native ; les interactions restent testées dans le DOM simulé.
if (!dom.window.HTMLDialogElement.prototype.showModal) {
  dom.window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
    this.querySelector('button')?.focus();
  };
  dom.window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
}
const { createElement: h } = await import('react');
const { render, cleanup, fireEvent, waitFor, act, within } = await import('@testing-library/react');
const { createMemoryRouter, RouterProvider } = await import('react-router');
const { CosmosProvider } = await import('../app/state/CosmosContext.tsx');
const { createControllerClass } = await import('../app/state/CosmosController.js');
const { canonicalPath, readRoute, routeUrl } = await import('../app/state/routing.ts');
const { default: AppShell } = await import('../app/components/AppShell.tsx');
const pages = await Promise.all(
  ['cosmos', 'echeances', 'journal', 'modeles'].map((name) =>
    import(`../app/routes/${name}.tsx`).then((m) => ({
      path: name + (['cosmos', 'echeances'].includes(name) ? '/:miniId?' : ''),
      Component: m.default,
    })),
  ),
);
pages.push(
  { index: true, Component: (await import('../app/routes/redirect.tsx')).default },
  { path: '*', Component: (await import('../app/routes/fallback.tsx')).default },
);
const floorTitles = {
  ETHOS: 'ETHOS — LA CRÉDIBILITÉ',
  LOGOS: 'LOGOS — L’ORDRE',
  PATHOS: 'PATHOS — L’ÉNERGIE',
};
const row = {
  id: 'mc-test',
  cosmos: 'TRAVAIL',
  name: 'Projet de test',
  objectif: 'Objectif initial',
  entropie: 'Un risque',
  reponse: 'Une réponse',
  startAt: '2026-01-01',
  cloture: '2027-12-31',
  actions: [{ text: 'Première étape', done: false }],
};

async function mount(t, path = '/cosmos', { openCosmos = true, clearStorage = true } = {}) {
  if (clearStorage) {
    localStorage.clear();
    localStorage.setItem(
      'cosmos-app-v1',
      JSON.stringify({
        version: 1,
        cosmos: ['TRAVAIL'],
        miniCosmos: [row],
        journal: [],
        titresDe: { TRAVAIL: ['PROJETS'] },
      }),
    );
  }
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args.map(String).join(' ')));
  let controller;
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: h(
          CosmosProvider,
          {
            createController: () => {
              controller = new (createControllerClass({ makeSync: async () => null }))();
              return controller;
            },
          },
          h(AppShell),
        ),
        children: pages,
      },
    ],
    { initialEntries: [path] },
  );
  const ui = render(h(RouterProvider, { router }));
  t.after(() => {
    cleanup();
    router.dispose();
    assert.deepEqual(errors, [], 'aucune erreur React ni propriété DOM invalide');
  });
  await waitFor(() => {
    assert.equal(controller.state.ready, true);
    assert.equal(router.state.location.pathname, canonicalPath(path.split('?')[0]));
  });
  if (openCosmos && readRoute(path.split('?')[0]).view === 'table')
    fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  return { ui, controller, router };
}

test('React Router conserve les anciennes routes et encode les identifiants', () => {
  assert.equal(canonicalPath('/tableau/mc-a'), '/cosmos/mc-a');
  assert.equal(canonicalPath('/'), '/cosmos');
  assert.equal(routeUrl('echeances', 'a b'), '/echeances/a%20b');
  assert.deepEqual(readRoute('/echeances/a%20b'), { view: 'echeances', selected: 'a b' });
  assert.deepEqual(readRoute('/cosmos'), { view: 'table', selected: null });
  assert.equal(routeUrl('table', null), '/cosmos');
  assert.equal(routeUrl('table', 'a b'), '/cosmos/a%20b');
  assert.deepEqual(readRoute('/cosmos/a%20b'), { view: 'table', selected: 'a b' });
  assert.equal(canonicalPath('/cosmos-test/a%20b'), '/cosmos-test/a%20b');
  assert.deepEqual(readRoute('/cosmos-test/a%20b'), { view: 'table', selected: null });
});

test('Cosmos : fiches, navigation et préférences de la page d’essai conservées', async t => {
  let { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  ui.unmount();
  router.dispose();
  localStorage.setItem('cosmos-test-plis-v1', JSON.stringify({ open: ['floor:logos', 'cosmos:TRAVAIL'] }));
  ({ ui, controller, router } = await mount(t, '/cosmos?origine=essai', { openCosmos: false, clearStorage: false }));
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.equal(router.state.location.search, '?origine=essai');
  assert.equal(router.state.historyAction, 'POP');
  assert.equal(controller.state.view, 'table');
  assert.ok(ui.getByText('Projet de test'));
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS }).getAttribute('aria-expanded'), 'false');
  assert.equal(ui.container.querySelector('.etage-title-row'), null);
  assert.ok(ui.container.querySelector('main.cosmos-table'));
  assert.match(ui.getByRole('link', { name: 'Cosmos', exact: true }).style.background, /rgba/);
  await act(async () => router.navigate('/cosmos/mc-test?origine=fiche'));
  await ui.findByRole('button', { name: 'Modifier', exact: true });
  assert.equal(router.state.location.pathname, '/cosmos/mc-test');
  assert.equal(router.state.location.search, '?origine=fiche');
  assert.equal(router.state.historyAction, 'PUSH');
  assert.equal(controller.state.selected, 'mc-test');
  await act(async () => router.navigate(-1));
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.equal(controller.state.selected, null);
  await act(async () => router.navigate('/'));
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos'));
  assert.ok(ui.getByText('Projet de test'));
});

test('Cosmos : la création depuis l’en-tête conserve filtres et replis ainsi que les saisies rapides', async t => {
  const { ui, controller } = await mount(t, '/cosmos', { openCosmos: false });
  fireEvent.change(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }), { target: { value: 'Introuvable' } });
  fireEvent.click(ui.getByRole('button', { name: '+ cosmos', exact: true }));
  const input = await ui.findByPlaceholderText('ENTREPRISE, FAMILLE, RELATIONS…');
  fireEvent.change(input, { target: { value: 'Nouveau domaine' } });
  fireEvent.click(ui.getByRole('button', { name: 'Pathos', exact: true }));
  fireEvent.keyDown(input, { key: 'Enter' });
  assert.equal(controller.state.showCosmosModal, false);
  assert.equal(controller.state.etageDe['NOUVEAU DOMAINE'], 'pathos');
  assert.equal(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }).value, 'Introuvable');
  fireEvent.change(ui.getByRole('searchbox'), { target: { value: '' } });
  assert.equal(ui.getByRole('button', { name: floorTitles.PATHOS }).getAttribute('aria-expanded'), 'false');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.PATHOS }));
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le cosmos NOUVEAU DOMAINE' }));
  const quick = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans NOUVEAU DOMAINE' });
  fireEvent.change(quick, { target: { value: 'Idée à garder' } });
  fireEvent.click(ui.getByRole('button', { name: floorTitles.PATHOS }));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.PATHOS }));
  assert.equal(ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans NOUVEAU DOMAINE' }).value, 'Idée à garder');
  assert.equal(controller.state.rows.length, 1);
  assert.deepEqual(controller.state.journal, []);
});

async function mountCosmosDrag(t) {
  const result = await mount(t, '/cosmos');
  act(() => result.controller.setState({
    cosmos: ['TRAVAIL', 'ATELIER', 'VIDE', 'AUTRE'],
    etageDe: { TRAVAIL: 'logos', ATELIER: 'logos', VIDE: 'logos', AUTRE: 'ethos' },
    sections: [
      { id: 'g1', name: 'PROJETS', etage: 'logos' },
      { id: 'g2', name: 'RÉSERVE', etage: 'logos' },
      { id: 'g3', name: 'VERTUS', etage: 'ethos' },
      { id: 'g4', name: 'GROUPE VIDE', etage: 'pathos' },
    ],
    sectionDe: { TRAVAIL: 'g1', ATELIER: 'g2', VIDE: 'g2', AUTRE: 'g3' },
    titresDe: { TRAVAIL: ['A', 'B'], ATELIER: ['ACCUEIL', 'RUBRIQUE VIDE'], VIDE: ['À CRÉER'] },
    rows: [
      { ...row, titre: 'A', actuel: 'Une mesure', pause: false },
      { ...row, id: 'paused', name: 'Projet en pause', titre: 'A', pause: true },
      { ...row, id: 'third', name: 'Troisième projet', titre: 'B' },
      { ...row, id: 'target', name: 'Projet cible', cosmos: 'ATELIER', titre: 'ACCUEIL', pause: true },
    ],
  }));
  fireEvent.click(result.ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  return result;
}
function cosmosTarget(ui, target) {
  const node = Array.from(ui.container.querySelectorAll('[data-ct-drop]')).find(node => node.dataset.ctDrop === JSON.stringify(target));
  assert.ok(node, 'destination disponible : ' + JSON.stringify(target));
  return node;
}
function beginCosmosDrag(ui, label) {
  const source = ui.getByRole('button', { name: 'Déplacer ' + label });
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData() {}, setDragImage() {} };
  fireEvent.dragStart(source, { dataTransfer });
  return { source, dataTransfer };
}
function cosmosDragEvent(node, type, dataTransfer, placement = 'before') {
  node.getBoundingClientRect = () => ({ top: 100, height: 40, bottom: 140 });
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { dataTransfer, clientY: placement === 'after' ? 135 : 105 });
  fireEvent(node, event);
  return event;
}
function finishCosmosDrag(ui, drag, target, placement = 'before') {
  const node = cosmosTarget(ui, target);
  cosmosDragEvent(node, 'dragover', drag.dataTransfer, placement);
  cosmosDragEvent(node, 'drop', drag.dataTransfer, placement);
  fireEvent.dragEnd(drag.source, { dataTransfer: drag.dataTransfer });
}
const savedCosmosData = controller => {
  const { exportedAt, view, ...data } = controller.serialize();
  return JSON.parse(JSON.stringify(data));
};

test('cosmos drag : poignée, insertion avant/après et changement de rubrique conservent les statuts et champs', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = JSON.parse(JSON.stringify(controller.state.rows));
  assert.equal(ui.getByRole('button', { name: 'Ouvrir la fiche de Projet de test' }).closest('tr').draggable, true);
  const drag = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  assert.equal(controller.pollState(), null, 'la relève est suspendue pendant le déplacement');
  const target = cosmosTarget(ui, { type: 'row', id: 'paused' });
  assert.equal(cosmosDragEvent(target, 'dragover', drag.dataTransfer, 'after').defaultPrevented, true);
  assert.equal(target.dataset.dropPosition, 'after');
  assert.deepEqual(controller.state.rows, before, 'aucune mutation avant le dépôt');
  fireEvent.click(ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' }));
  assert.equal(controller.state.rows[0].pause, false);
  fireEvent.click(target.cells[2]);
  assert.equal(router.state.location.pathname, '/cosmos');
  finishCosmosDrag(ui, drag, { type: 'row', id: 'paused' }, 'after');
  assert.deepEqual(controller.state.rows.map(x => x.id), ['paused', 'mc-test', 'third', 'target']);
  assert.deepEqual(controller.state.rows.find(x => x.id === 'mc-test'), before[0]);
  assert.equal(controller.state.drag, null);
  assert.notEqual(controller.pollState(), null);
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le mini-cosmos Projet de test'), { type: 'row', id: 'third' }, 'after');
  assert.deepEqual(controller.state.rows.map(x => x.id), ['paused', 'third', 'mc-test', 'target']);
  assert.equal(controller.state.rows.find(x => x.id === 'mc-test').titre, 'B');
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le mini-cosmos Projet de test'), { type: 'row', id: 'paused' }, 'before');
  assert.deepEqual(controller.state.rows, before);
  assert.deepEqual(controller.state.journal, []);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos, before);
});

test('cosmos drag : mini-cosmos vers une rubrique vide, un autre cosmos et un cosmos vide', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  const before = JSON.parse(JSON.stringify(controller.state.rows[0]));
  assert.ok(ui.getByText('RUBRIQUE VIDE', { exact: true }), 'une séparation vide reste disponible pour recevoir des mini-cosmos');
  const drag = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  assert.ok(ui.getByText('RUBRIQUE VIDE', { exact: true }));
  finishCosmosDrag(ui, drag, { type: 'rubrique', cosmos: 'ATELIER', name: 'RUBRIQUE VIDE' });
  assert.deepEqual(controller.state.rows.find(x => x.id === 'mc-test'), { ...before, cosmos: 'ATELIER', titre: 'RUBRIQUE VIDE' });
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le mini-cosmos Projet de test'), { type: 'row', id: 'target' });
  assert.deepEqual(controller.state.rows.filter(x => x.cosmos === 'ATELIER').map(x => x.id), ['mc-test', 'target']);
  assert.equal(controller.state.rows.find(x => x.id === 'mc-test').titre, 'ACCUEIL');
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le mini-cosmos Projet de test'), { type: 'cosmos', name: 'VIDE' });
  const { titre, ...rest } = before;
  assert.deepEqual(controller.state.rows.find(x => x.id === 'mc-test'), { ...rest, cosmos: 'VIDE' });
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Projet de test' }));
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos drag : cosmos entre groupes et étages, avec enfants, sans modifier les plis de l’ancienne interface', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  act(() => controller.setState({ plis: { cosmos: {}, sections: { g4: 1 }, etages: { pathos: 1 } } }));
  const beforeRows = JSON.parse(JSON.stringify(controller.state.rows));
  const beforePlis = JSON.parse(JSON.stringify(controller.state.plis));
  const beforeTitles = JSON.parse(JSON.stringify(controller.state.titresDe));
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le cosmos TRAVAIL'), { type: 'cosmos', name: 'ATELIER' }, 'after');
  assert.deepEqual(controller.state.cosmos.filter(x => controller.state.sectionDe[x] === 'g2'), ['ATELIER', 'TRAVAIL', 'VIDE']);
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le cosmos TRAVAIL'), { type: 'cosmos', name: 'ATELIER' }, 'before');
  assert.deepEqual(controller.state.cosmos.filter(x => controller.state.sectionDe[x] === 'g2'), ['TRAVAIL', 'ATELIER', 'VIDE']);
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le cosmos TRAVAIL'), { type: 'section', id: 'g4' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'pathos');
  assert.equal(controller.state.sectionDe.TRAVAIL, 'g4');
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le cosmos TRAVAIL'), { type: 'floor', id: 'ethos' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'ethos');
  assert.equal(controller.state.sectionDe.TRAVAIL, undefined);
  assert.deepEqual(Array.from(ui.getByRole('table', { name: 'Tableau ETHOS' }).querySelectorAll('.ct-node-name'), node => node.textContent), ['TRAVAIL', 'VERTUS', 'AUTRE']);
  assert.equal(ui.queryByText('Sans groupe', { exact: true }), null);
  assert.deepEqual(controller.state.rows, beforeRows);
  assert.deepEqual(controller.state.plis, beforePlis);
  assert.deepEqual(controller.state.titresDe, beforeTitles);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).etageDe.TRAVAIL, 'ethos');
});

test('cosmos drag : les groupes se réordonnent avec leurs cosmos uniquement dans leur étage', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le groupe PROJETS'), { type: 'section', id: 'g2' }, 'after');
  assert.deepEqual(controller.state.sections.filter(x => x.etage === 'logos').map(x => x.id), ['g2', 'g1']);
  assert.deepEqual(controller.state.cosmos.filter(x => controller.state.etageDe[x] === 'logos'), ['ATELIER', 'VIDE', 'TRAVAIL']);
  finishCosmosDrag(ui, beginCosmosDrag(ui, 'le groupe PROJETS'), { type: 'section', id: 'g2' }, 'before');
  assert.deepEqual(savedCosmosData(controller), before);
  const invalid = beginCosmosDrag(ui, 'le groupe PROJETS');
  const target = cosmosTarget(ui, { type: 'section', id: 'g3' });
  assert.equal(cosmosDragEvent(target, 'dragover', invalid.dataTransfer).defaultPrevented, false);
  assert.equal(invalid.dataTransfer.dropEffect, 'none');
  finishCosmosDrag(ui, invalid, { type: 'section', id: 'g3' });
  assert.deepEqual(savedCosmosData(controller), before);
});

test('cosmos drag : survol des accordéons, annulation et destinations masquées par les filtres', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos ATELIER' }));
  fireEvent.click(ui.getByRole('button', { name: 'Replier le groupe RÉSERVE' }));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }));
  const before = savedCosmosData(controller);
  const drag = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  cosmosDragEvent(cosmosTarget(ui, { type: 'floor', id: 'ethos' }), 'dragover', drag.dataTransfer);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Replier le groupe VERTUS' })));
  cosmosDragEvent(cosmosTarget(ui, { type: 'section', id: 'g2' }), 'dragover', drag.dataTransfer);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos ATELIER' })));
  cosmosDragEvent(cosmosTarget(ui, { type: 'cosmos', name: 'ATELIER' }), 'dragover', drag.dataTransfer);
  await waitFor(() => assert.ok(ui.getByText('RUBRIQUE VIDE', { exact: true })));
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(controller.state.drag, null);
  assert.deepEqual(savedCosmosData(controller), before);
  assert.equal(ui.queryByRole('table', { name: 'Tableau ETHOS' }), null);
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe RÉSERVE' }));
  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  fireEvent.change(query, { target: { value: 'Projet de test' } });
  assert.equal(ui.queryByText('ATELIER', { exact: true }), null);
  const next = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  assert.ok(ui.getByText('ATELIER', { exact: true }));
  assert.equal(query.disabled, true);
  finishCosmosDrag(ui, next, { type: 'cosmos', name: 'ATELIER' });
  assert.equal(query.value, 'Projet de test');
  assert.equal(query.disabled, false);
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Projet de test' }));
  assert.equal(controller.state.rows.find(x => x.id === 'mc-test').cosmos, 'ATELIER');
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos drag : refus en lecture seule, dépôt externe, élément supprimé et nettoyage au changement de page', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  cosmosDragEvent(cosmosTarget(ui, { type: 'floor', id: 'ethos' }), 'drop', { getData: () => 'TRAVAIL' });
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: true }));
  const handle = ui.getByRole('button', { name: 'Déplacer le cosmos TRAVAIL' });
  assert.equal(handle.disabled, true);
  assert.equal(handle.draggable, false);
  beginCosmosDrag(ui, 'le cosmos TRAVAIL');
  assert.equal(controller.state.drag ?? null, null);
  act(() => controller.setState({ syncRefreshing: false }));
  const drag = beginCosmosDrag(ui, 'le cosmos TRAVAIL');
  act(() => controller.setState({ syncRefreshing: true }));
  finishCosmosDrag(ui, drag, { type: 'floor', id: 'ethos' });
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  const deleted = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  act(() => controller.setState({ rows: controller.state.rows.filter(x => x.id !== 'mc-test') }));
  finishCosmosDrag(ui, deleted, { type: 'cosmos', name: 'ATELIER' });
  assert.equal(controller.state.rows.some(x => x.id === 'mc-test'), false);
  beginCosmosDrag(ui, 'le cosmos TRAVAIL');
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.drag, null);
  assert.equal(controller.state.over, null);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos drag : déplacement au clavier et annulation ne déclenchent pas la fiche', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const handle = ui.getByRole('button', { name: 'Déplacer le cosmos TRAVAIL' });
  handle.focus();
  fireEvent.keyDown(handle, { key: 'Enter' });
  assert.equal(controller.state.drag.id, 'TRAVAIL');
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  assert.equal(cosmosTarget(ui, { type: 'floor', id: 'pathos' }).dataset.dropPosition, 'inside');
  fireEvent.keyDown(handle, { key: 'Enter' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'pathos');
  assert.equal(controller.state.sectionDe.TRAVAIL, undefined);
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.equal(controller.state.drag, null);
  const before = savedCosmosData(controller);
  const miniHandle = ui.getByRole('button', { name: 'Déplacer le mini-cosmos Projet de test' });
  fireEvent.keyDown(miniHandle, { key: ' ' });
  fireEvent.keyDown(miniHandle, { key: 'ArrowDown' });
  fireEvent.keyDown(miniHandle, { key: 'Escape' });
  assert.deepEqual(savedCosmosData(controller), before);
  assert.equal(controller.state.drag, null);
});

function chooseCosmosAction(ui, cosmos, action) {
  fireEvent.click(ui.getByRole('button', { name: 'Actions du cosmos ' + cosmos }));
  fireEvent.click(within(ui.getByRole('group', { name: 'Actions de ' + cosmos })).getByRole('button', { name: action, exact: true }));
}

function linePointer(node, type, extra = {}) {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra });
  fireEvent(node, event);
}
function beginLineDrag(ui, target, origin) {
  const source = cosmosTarget(ui, target);
  linePointer(origin || source.cells[1], 'pointerdown');
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData() {}, setDragImage() {} };
  const event = new dom.window.Event('dragstart', { bubbles: true, cancelable: true });
  Object.assign(event, { dataTransfer });
  fireEvent(source, event);
  return { source, dataTransfer, event };
}

test('cosmos glissement immédiat : toute la ligne utilise le drag natif, sans attente et sans clic après dépôt', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = JSON.parse(JSON.stringify(controller.state.rows));
  const drag = beginLineDrag(ui, { type: 'row', id: 'mc-test' });
  assert.equal(drag.source.draggable, true);
  assert.equal(drag.event.defaultPrevented, false);
  assert.deepEqual(controller.state.drag, { type: 'row', id: 'mc-test' });
  assert.equal(controller.pollState(), null);
  assert.equal(drag.dataTransfer.effectAllowed, 'move');
  assert.deepEqual(controller.state.rows, before, 'aucune écriture avant le dépôt');
  finishCosmosDrag(ui, drag, { type: 'row', id: 'paused' }, 'after');
  assert.deepEqual(controller.state.rows.map(x => x.id), ['paused', 'mc-test', 'third', 'target']);
  assert.deepEqual(controller.state.rows.find(x => x.id === 'mc-test'), before[0]);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos, controller.state.rows);
  assert.deepEqual(controller.state.journal, []);
  fireEvent.click(drag.source.cells[1]);
  assert.equal(router.state.location.pathname, '/cosmos');
  linePointer(drag.source.cells[1], 'pointerdown');
  linePointer(drag.source.cells[1], 'pointerup');
  fireEvent.click(drag.source.cells[1]);
  assert.equal(router.state.location.pathname, '/cosmos/mc-test');
});

test('cosmos glissement immédiat : noms de cosmos et groupes déplaçables, clics simples et commandes indépendants', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = JSON.parse(JSON.stringify(controller.state.rows));
  const name = ui.getByRole('button', { name: 'Replier le cosmos TRAVAIL' });
  linePointer(name, 'pointerdown');
  linePointer(name, 'pointerup');
  fireEvent.click(name);
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.equal(controller.state.drag ?? null, null);
  const drag = beginLineDrag(ui, { type: 'cosmos', name: 'TRAVAIL' }, name);
  finishCosmosDrag(ui, drag, { type: 'section', id: 'g4' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'pathos');
  assert.equal(controller.state.sectionDe.TRAVAIL, 'g4');
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }), 'le cosmos déplacé reste fermé');
  const group = beginLineDrag(ui, { type: 'section', id: 'g2' }, ui.getByRole('button', { name: 'Replier le groupe RÉSERVE' }));
  finishCosmosDrag(ui, group, { type: 'section', id: 'g1' }, 'before');
  assert.deepEqual(controller.state.sections.filter(x => x.etage === 'logos').map(x => x.id), ['g2', 'g1']);
  assert.deepEqual(controller.state.rows, before);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(router.state.location.pathname, '/cosmos');
});

test('cosmos glissement immédiat : tags, menus, champs et lecture seule ne démarrent pas un déplacement', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  for (const name of ['Actif — Mettre en pause Projet de test', /^Étapes de Projet de test :/, 'Développer les textes de Projet de test']) {
    const control = ui.getByRole('button', { name });
    const rejected = beginLineDrag(ui, { type: 'row', id: 'mc-test' }, control);
    assert.equal(rejected.event.defaultPrevented, true);
    assert.equal(controller.state.drag ?? null, null);
  }
  const menu = ui.getByRole('button', { name: 'Actions du cosmos TRAVAIL' });
  assert.equal(beginLineDrag(ui, { type: 'cosmos', name: 'TRAVAIL' }, menu).event.defaultPrevented, true);
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.click(menu);
  assert.ok(ui.getByRole('group', { name: 'Actions de TRAVAIL' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  const status = ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' });
  linePointer(status, 'pointerdown');
  linePointer(status, 'pointerup');
  fireEvent.click(status);
  assert.equal(controller.state.rows.find(x => x.id === 'mc-test').pause, true);
  const steps = ui.getByRole('button', { name: /^Étapes de Projet de test :/ });
  linePointer(steps, 'pointerdown');
  linePointer(steps, 'pointerup');
  fireEvent.click(steps);
  assert.ok(ui.getByRole('dialog', { name: 'Étapes de Projet de test' }));
  fireEvent.click(ui.getByRole('button', { name: 'Fermer les étapes' }));
  act(() => controller.setState({ syncRefreshing: true }));
  const rejected = beginLineDrag(ui, { type: 'row', id: 'mc-test' });
  assert.equal(rejected.source.draggable, false);
  assert.equal(rejected.event.defaultPrevented, true);
  assert.equal(controller.state.drag ?? null, null);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos dépôt : les accordéons des cosmos, groupes et étages conservent leurs ouvertures et leur stockage', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos ATELIER' }));
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.ETHOS }));
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  finishCosmosDrag(ui, beginLineDrag(ui, { type: 'cosmos', name: 'TRAVAIL' }), { type: 'cosmos', name: 'ATELIER' }, 'after');
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos ATELIER' }));
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  // Les destinations fermées restent disponibles sur leur en-tête.
  finishCosmosDrag(ui, beginLineDrag(ui, { type: 'cosmos', name: 'TRAVAIL' }), { type: 'floor', id: 'ethos' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'ethos');
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS }).getAttribute('aria-expanded'), 'false');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  finishCosmosDrag(ui, beginLineDrag(ui, { type: 'cosmos', name: 'ATELIER' }), { type: 'section', id: 'g4' });
  linePointer(ui.getByRole('button', { name: 'Replier le groupe RÉSERVE' }), 'pointerdown');
  fireEvent.click(ui.getByRole('button', { name: 'Replier le groupe RÉSERVE' }));
  const foldsWithGroup = localStorage.getItem('cosmos-test-plis-v1');
  finishCosmosDrag(ui, beginLineDrag(ui, { type: 'cosmos', name: 'ATELIER' }), { type: 'section', id: 'g2' });
  assert.equal(ui.getByRole('button', { name: 'Déplier le groupe RÉSERVE' }).getAttribute('aria-expanded'), 'false');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), foldsWithGroup);
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS }).getAttribute('aria-expanded'), 'false');
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe RÉSERVE' }));
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos dépôt : le survol reste temporaire après dépôt et le clavier ne déplie pas la destination', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos ATELIER' }));
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  const mini = beginLineDrag(ui, { type: 'row', id: 'mc-test' });
  cosmosDragEvent(cosmosTarget(ui, { type: 'cosmos', name: 'ATELIER' }), 'dragover', mini.dataTransfer);
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Replier le cosmos ATELIER' })));
  finishCosmosDrag(ui, mini, { type: 'rubrique', cosmos: 'ATELIER', name: 'RUBRIQUE VIDE' });
  assert.equal(controller.state.rows.find(x => x.id === 'mc-test').titre, 'RUBRIQUE VIDE');
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos ATELIER' }));
  assert.equal(ui.queryByRole('button', { name: 'Ouvrir la fiche de Projet de test' }), null);
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  linePointer(ui.getByRole('button', { name: floorTitles.PATHOS }), 'pointerdown');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.PATHOS }));
  const closedFloor = localStorage.getItem('cosmos-test-plis-v1');
  const handle = ui.getByRole('button', { name: 'Déplacer le cosmos TRAVAIL' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  assert.equal(cosmosTarget(ui, { type: 'floor', id: 'pathos' }).dataset.dropPosition, 'inside');
  fireEvent.keyDown(handle, { key: 'Enter' });
  assert.equal(controller.state.etageDe.TRAVAIL, 'pathos');
  assert.equal(ui.getByRole('button', { name: floorTitles.PATHOS }).getAttribute('aria-expanded'), 'false');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), closedFloor);
  await waitFor(() => assert.equal(document.activeElement === ui.getByRole('button', { name: floorTitles.PATHOS }), true));
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos actions : trois commandes et renommage validé conservant enfants, groupe, rubriques et brouillons', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  act(() => {
    controller.setQuickName('TRAVAIL', 'À poursuivre');
    controller.setState({ plis: { cosmos: { TRAVAIL: 1 }, etages: {}, sections: {} } });
  });
  const before = savedCosmosData(controller);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  const trigger = ui.getByRole('button', { name: 'Actions du cosmos TRAVAIL' });
  assert.ok(trigger.closest('.ct-cosmos-row'));
  fireEvent.click(trigger);
  assert.deepEqual(within(ui.getByRole('group', { name: 'Actions de TRAVAIL' })).getAllByRole('button').map(x => x.textContent), ['Modifier', 'Supprimer', 'Ajouter une séparation']);
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  fireEvent.keyDown(trigger, { key: 'Escape' });
  assert.equal(ui.queryByRole('group', { name: 'Actions de TRAVAIL' }), null);
  chooseCosmosAction(ui, 'TRAVAIL', 'Modifier');
  const dialog = ui.getByRole('dialog', { name: 'Modifier le cosmos' });
  const input = within(dialog).getByRole('textbox', { name: 'Nom du cosmos' });
  assert.equal(document.activeElement, input);
  assert.equal(controller.pollState(), null);
  fireEvent.change(input, { target: { value: ' atelier ' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /existe déjà/);
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.change(input, { target: { value: ' Travail renommé ' } });
  fireEvent.submit(input.form);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.equal(controller.state.sectionDe['TRAVAIL RENOMMÉ'], 'g1');
  assert.equal(controller.state.etageDe['TRAVAIL RENOMMÉ'], 'logos');
  assert.deepEqual(controller.state.titresDe['TRAVAIL RENOMMÉ'], ['A', 'B']);
  assert.equal(controller.state.titresDe.TRAVAIL, undefined);
  assert.deepEqual(controller.state.rows, before.miniCosmos.map(x => x.cosmos === 'TRAVAIL' ? { ...x, cosmos: 'TRAVAIL RENOMMÉ' } : x));
  assert.equal(controller.state.quickDrafts['TRAVAIL RENOMMÉ'].name, 'À poursuivre');
  assert.equal(controller.state.quickDrafts.TRAVAIL, undefined);
  assert.equal(controller.state.plis.cosmos['TRAVAIL RENOMMÉ'], 1);
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL RENOMMÉ' }));
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.deepEqual(controller.state.journal, []);
  assert.ok(JSON.parse(localStorage.getItem('cosmos-app-v1')).cosmos.includes('TRAVAIL RENOMMÉ'));
});

test('cosmos actions : suppression confirmée compte toutes les lignes et préserve les autres cosmos', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  act(() => controller.setQuickName('TRAVAIL', 'Brouillon à supprimer'));
  fireEvent.change(ui.getByRole('combobox', { name: 'Filtrer par statut' }), { target: { value: 'Actif' } });
  const before = savedCosmosData(controller);
  chooseCosmosAction(ui, 'TRAVAIL', 'Supprimer');
  let panel = within(ui.getByRole('dialog', { name: 'Supprimer le cosmos' }));
  assert.ok(panel.getByText('TRAVAIL et ses 3 mini-cosmos seront supprimés.'));
  assert.equal(document.activeElement, panel.getByRole('button', { name: 'Annuler' }));
  fireEvent.click(panel.getByRole('button', { name: 'Annuler' }));
  assert.deepEqual(savedCosmosData(controller), before);
  chooseCosmosAction(ui, 'TRAVAIL', 'Supprimer');
  panel = within(ui.getByRole('dialog', { name: 'Supprimer le cosmos' }));
  act(() => controller.setState({ syncRefreshing: true }));
  const remove = panel.getByRole('button', { name: 'Supprimer', exact: true });
  assert.equal(remove.disabled, true);
  fireEvent.submit(remove.form);
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(remove);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.deepEqual(controller.state.cosmos, before.cosmos.filter(x => x !== 'TRAVAIL'));
  assert.deepEqual(controller.state.rows, before.miniCosmos.filter(x => x.cosmos !== 'TRAVAIL'));
  assert.deepEqual(controller.state.sections, before.sections);
  assert.equal(controller.state.titresDe.TRAVAIL, undefined);
  assert.equal(controller.state.etageDe.TRAVAIL, undefined);
  assert.equal(controller.state.sectionDe.TRAVAIL, undefined);
  assert.equal(controller.state.quickDrafts.TRAVAIL, undefined);
  assert.deepEqual(controller.state.titresDe.ATELIER, before.titresDe.ATELIER);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).cosmos.includes('TRAVAIL'), false);
});

test('cosmos actions : ajout de séparation visible à vide, doublon refusé et création rapide dans cette séparation', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const beforeRows = JSON.parse(JSON.stringify(controller.state.rows));
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  chooseCosmosAction(ui, 'TRAVAIL', 'Ajouter une séparation');
  const dialog = ui.getByRole('dialog', { name: 'Ajouter une séparation' });
  const input = within(dialog).getByRole('textbox', { name: 'Nom de la séparation' });
  assert.equal(within(dialog).getByRole('button', { name: 'Ajouter', exact: true }).disabled, true);
  fireEvent.change(input, { target: { value: 'a' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /existe déjà/);
  fireEvent.change(input, { target: { value: ' NOUVELLE RUBRIQUE ' } });
  fireEvent.submit(input.form);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.deepEqual(controller.state.titresDe.TRAVAIL, ['A', 'B', 'NOUVELLE RUBRIQUE']);
  assert.ok(ui.getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  assert.ok(ui.getByText('NOUVELLE RUBRIQUE', { exact: true }).closest('.ct-rubrique-row'));
  assert.deepEqual(controller.state.rows, beforeRows);
  const quick = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  assert.ok(within(quick.form).getByText('Sous « NOUVELLE RUBRIQUE »'));
  fireEvent.change(quick, { target: { value: 'Dans la séparation' } });
  fireEvent.submit(quick.form);
  assert.equal(controller.state.rows.at(-1).titre, 'NOUVELLE RUBRIQUE');
  assert.deepEqual(controller.state.journal, []);
  chooseCosmosAction(ui, 'TRAVAIL', 'Modifier');
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.cosmosAction, null);
});

function chooseRubriqueAction(ui, cosmos, name, action) {
  const label = `Actions de la séparation ${name} dans ${cosmos}`;
  fireEvent.click(ui.getByRole('button', { name: label }));
  fireEvent.click(within(ui.getByRole('group', { name: label })).getByRole('button', { name: action, exact: true }));
}

test('cosmos séparations : deux actions, renommage de toutes les lignes et persistance sans toucher aux autres cosmos', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  act(() => {
    controller.setState({
      titresDe: { ...controller.state.titresDe, ATELIER: ['A', 'RUBRIQUE VIDE'] },
      rows: controller.state.rows.map(x => x.id === 'target' ? { ...x, titre: 'A' } : x),
    });
    controller.setQuickName('TRAVAIL', 'Idée conservée');
  });
  const before = savedCosmosData(controller);
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  const trigger = ui.getByRole('button', { name: 'Actions de la séparation A dans TRAVAIL' });
  assert.ok(trigger.closest('.ct-rubrique-row'));
  assert.equal(trigger.closest('td').colSpan, 9);
  fireEvent.click(trigger);
  const menu = ui.getByRole('group', { name: 'Actions de la séparation A dans TRAVAIL' });
  assert.deepEqual(within(menu).getAllByRole('button').map(x => x.textContent), ['Modifier', 'Supprimer']);
  assert.equal(router.state.location.pathname, '/cosmos');
  fireEvent.keyDown(trigger, { key: 'Escape' });
  assert.equal(ui.queryByRole('group', { name: 'Actions de la séparation A dans TRAVAIL' }), null);
  chooseRubriqueAction(ui, 'TRAVAIL', 'A', 'Modifier');
  const dialog = ui.getByRole('dialog', { name: 'Modifier la séparation' });
  const input = within(dialog).getByRole('textbox', { name: 'Nom de la séparation' });
  assert.equal(document.activeElement, input);
  assert.equal(controller.pollState(), null);
  assert.equal(ui.getByRole('button', { name: 'Déplacer le cosmos TRAVAIL' }).disabled, true);
  assert.equal(ui.getByRole('button', { name: 'Ajouter un groupe dans LOGOS' }).disabled, true);
  assert.equal(ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' }).disabled, true);
  fireEvent.change(input, { target: { value: ' b ' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /existe déjà/);
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.change(input, { target: { value: ' ' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /1 à 60/);
  fireEvent.change(input, { target: { value: 'x'.repeat(61) } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /1 à 60/);
  fireEvent.change(input, { target: { value: ' NOUVEAU NOM ' } });
  fireEvent.submit(input.form);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.deepEqual(controller.state.titresDe.TRAVAIL, ['NOUVEAU NOM', 'B']);
  assert.deepEqual(controller.state.rows, before.miniCosmos.map(x => x.cosmos === 'TRAVAIL' && x.titre === 'A' ? { ...x, titre: 'NOUVEAU NOM' } : x));
  assert.deepEqual(controller.state.titresDe.ATELIER, before.titresDe.ATELIER);
  assert.equal(controller.state.quickDrafts.TRAVAIL.name, 'Idée conservée');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos, controller.state.rows);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).titresDe, controller.state.titresDe);
  assert.deepEqual(controller.state.journal, []);
  await waitFor(() => assert.equal(document.activeElement === ui.getByRole('button', { name: 'Actions de la séparation NOUVEAU NOM dans TRAVAIL' }), true));
  assert.equal(router.state.location.pathname, '/cosmos');
});

test('cosmos séparations : suppression confirmée sous filtre conserve tous les mini-cosmos, leur ordre et leurs données', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  act(() => controller.setState({
    titresDe: { ...controller.state.titresDe, ATELIER: ['A', 'RUBRIQUE VIDE'] },
    rows: controller.state.rows.map(x => x.id === 'target' ? { ...x, titre: 'A' } : x),
  }));
  fireEvent.change(ui.getByRole('combobox', { name: 'Filtrer par statut' }), { target: { value: 'Actif' } });
  const before = savedCosmosData(controller);
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  chooseRubriqueAction(ui, 'TRAVAIL', 'A', 'Supprimer');
  let panel = within(ui.getByRole('dialog', { name: 'Supprimer la séparation' }));
  assert.match(panel.getByText(/Ses 2 mini-cosmos/).textContent, /conservés dans TRAVAIL, sans séparation/);
  assert.equal(document.activeElement, panel.getByRole('button', { name: 'Annuler' }));
  fireEvent.click(panel.getByRole('button', { name: 'Annuler' }));
  assert.deepEqual(savedCosmosData(controller), before);
  chooseRubriqueAction(ui, 'TRAVAIL', 'A', 'Supprimer');
  panel = within(ui.getByRole('dialog', { name: 'Supprimer la séparation' }));
  act(() => controller.setState({ syncRefreshing: true }));
  const remove = panel.getByRole('button', { name: 'Supprimer', exact: true });
  assert.equal(remove.disabled, true);
  fireEvent.submit(remove.form);
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(remove);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.deepEqual(controller.state.rows, before.miniCosmos.map(x => {
    if (x.cosmos !== 'TRAVAIL' || x.titre !== 'A') return x;
    const { titre, ...rest } = x;
    return rest;
  }));
  assert.deepEqual(controller.state.titresDe.TRAVAIL, ['B']);
  assert.deepEqual(controller.state.titresDe.ATELIER, before.titresDe.ATELIER);
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  assert.deepEqual(controller.state.journal, []);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos, controller.state.rows);
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Projet de test' }));
  assert.equal(ui.queryByRole('button', { name: 'Actions de la séparation A dans TRAVAIL' }), null);
  assert.equal(ui.getByRole('combobox', { name: 'Filtrer par statut' }).value, 'Actif');
});

test('cosmos séparations : titres vides ou issus des données, noms identiques ailleurs et cibles de déplacement mises à jour', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  act(() => controller.setState({
    rows: [...controller.state.rows, { ...row, id: 'orphan', name: 'Hors liste', titre: 'Ancienne' }],
  }));
  const before = savedCosmosData(controller);
  chooseRubriqueAction(ui, 'TRAVAIL', 'B', 'Modifier');
  let input = ui.getByRole('textbox', { name: 'Nom de la séparation' });
  fireEvent.change(input, { target: { value: 'ancienne' } });
  fireEvent.submit(input.form);
  assert.match(ui.getByRole('alert').textContent, /existe déjà/);
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent(ui.getByRole('dialog'), new dom.window.Event('cancel', { bubbles: true, cancelable: true }));
  chooseRubriqueAction(ui, 'TRAVAIL', 'Ancienne', 'Modifier');
  input = ui.getByRole('textbox', { name: 'Nom de la séparation' });
  fireEvent.change(input, { target: { value: 'ACCUEIL' } });
  fireEvent.submit(input.form);
  assert.deepEqual(controller.state.titresDe.TRAVAIL, ['A', 'B', 'ACCUEIL']);
  assert.equal(controller.state.rows.find(x => x.id === 'orphan').titre, 'ACCUEIL');
  const drag = beginCosmosDrag(ui, 'le mini-cosmos Troisième projet');
  finishCosmosDrag(ui, drag, { type: 'rubrique', cosmos: 'TRAVAIL', name: 'ACCUEIL' });
  assert.equal(controller.state.rows.find(x => x.id === 'third').titre, 'ACCUEIL');
  const trigger = ui.getByRole('button', { name: 'Actions de la séparation RUBRIQUE VIDE dans ATELIER' });
  linePointer(trigger, 'pointerdown');
  chooseRubriqueAction(ui, 'ATELIER', 'RUBRIQUE VIDE', 'Modifier');
  input = ui.getByRole('textbox', { name: 'Nom de la séparation' });
  fireEvent.change(input, { target: { value: 'VIDE RENOMMÉE' } });
  fireEvent.submit(input.form);
  assert.deepEqual(controller.state.titresDe.ATELIER, ['ACCUEIL', 'VIDE RENOMMÉE']);
  const rows = JSON.parse(JSON.stringify(controller.state.rows));
  chooseRubriqueAction(ui, 'ATELIER', 'VIDE RENOMMÉE', 'Supprimer');
  assert.ok(ui.getByText(/Ses 0 mini-cosmos/));
  fireEvent.click(within(ui.getByRole('dialog')).getByRole('button', { name: 'Supprimer', exact: true }));
  assert.deepEqual(controller.state.rows, rows);
  assert.deepEqual(controller.state.titresDe.ATELIER, ['ACCUEIL']);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos séparations : annulation, cible disparue, déplacement et navigation nettoient les actions', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  chooseRubriqueAction(ui, 'TRAVAIL', 'A', 'Modifier');
  let input = ui.getByRole('textbox', { name: 'Nom de la séparation' });
  fireEvent.change(input, { target: { value: 'À annuler' } });
  fireEvent(ui.getByRole('dialog'), new dom.window.Event('cancel', { bubbles: true, cancelable: true }));
  assert.equal(controller.state.rubriqueAction, null);
  assert.deepEqual(savedCosmosData(controller), before);
  const drag = beginCosmosDrag(ui, 'le mini-cosmos Projet de test');
  assert.equal(ui.getByRole('button', { name: 'Actions de la séparation A dans TRAVAIL' }).disabled, true);
  fireEvent.keyDown(document, { key: 'Escape' });
  linePointer(ui.getByRole('button', { name: 'Actions de la séparation A dans TRAVAIL' }), 'pointerdown');
  chooseRubriqueAction(ui, 'TRAVAIL', 'A', 'Modifier');
  input = ui.getByRole('textbox', { name: 'Nom de la séparation' });
  act(() => controller.supprimerTitre('TRAVAIL', 'A'));
  assert.equal(input.disabled, true);
  fireEvent.change(input, { target: { value: 'Ne pas recréer' } });
  fireEvent.submit(input.form);
  assert.match(ui.getByRole('alert').textContent, /n’existe plus/);
  assert.deepEqual(controller.state.titresDe.TRAVAIL, ['B']);
  fireEvent.click(ui.getByRole('button', { name: 'Annuler', exact: true }));
  chooseRubriqueAction(ui, 'TRAVAIL', 'B', 'Modifier');
  assert.equal(controller.pollState(), null);
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.rubriqueAction, null);
  assert.notEqual(controller.pollState(), null);
  assert.deepEqual(controller.state.journal, []);
});

function chooseGroupAction(ui, name, action) {
  fireEvent.click(ui.getByRole('button', { name: 'Actions du groupe ' + name }));
  fireEvent.click(within(ui.getByRole('group', { name: 'Actions du groupe ' + name })).getByRole('button', { name: action, exact: true }));
}

test('cosmos groupes : deux actions et renommage validé conservant identité, contenu, ordre et replis', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  act(() => controller.setQuickName('TRAVAIL', 'Idée à poursuivre'));
  const before = savedCosmosData(controller);
  const plis = JSON.stringify(controller.state.plis);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le groupe PROJETS' }));
  const trigger = ui.getByRole('button', { name: 'Actions du groupe PROJETS' });
  assert.ok(trigger.closest('.ct-section-row'));
  assert.equal(trigger.closest('td').colSpan, 9);
  fireEvent.click(trigger);
  const menu = ui.getByRole('group', { name: 'Actions du groupe PROJETS' });
  assert.deepEqual(within(menu).getAllByRole('button').map(x => x.textContent), ['Modifier', 'Supprimer']);
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  fireEvent.keyDown(trigger, { key: 'Escape' });
  assert.equal(ui.queryByRole('group', { name: 'Actions du groupe PROJETS' }), null);
  chooseGroupAction(ui, 'PROJETS', 'Modifier');
  const dialog = ui.getByRole('form', { name: 'Modifier le groupe' });
  assert.equal(dialog.closest('tr')?.classList.contains('ct-section-row'), true);
  assert.equal(ui.queryAllByRole('dialog').length, 0);
  const input = within(dialog).getByRole('textbox', { name: 'Nom du groupe' });
  assert.equal(document.activeElement, input);
  assert.equal(controller.pollState(), null);
  assert.equal(ui.getByRole('button', { name: 'Ajouter un groupe dans LOGOS' }).disabled, true);
  assert.equal(ui.getByRole('button', { name: 'Déplacer le groupe PROJETS' }).disabled, true);
  fireEvent.change(input, { target: { value: ' réserve ' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /existe déjà/);
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.change(input, { target: { value: ' ' } });
  fireEvent.submit(input.form);
  assert.match(within(dialog).getByRole('alert').textContent, /1 à 60/);
  fireEvent.change(input, { target: { value: ' VERTUS ' } });
  fireEvent.submit(input.form);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.deepEqual(savedCosmosData(controller), {
    ...before,
    sections: before.sections.map(x => x.id === 'g1' ? { ...x, name: 'VERTUS' } : x),
  });
  assert.equal(controller.state.quickDrafts.TRAVAIL.name, 'Idée à poursuivre');
  assert.equal(JSON.stringify(controller.state.plis), plis);
  assert.equal(ui.getAllByRole('button', { name: 'Déplier le groupe VERTUS' }).length, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).sections, controller.state.sections);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos groupes : suppression confirmée conserve tous les cosmos au-dessus des groupes, même sous filtre', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  fireEvent.change(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }), { target: { value: 'Projet cible' } });
  const before = savedCosmosData(controller);
  chooseGroupAction(ui, 'RÉSERVE', 'Supprimer');
  let dialog = ui.getByRole('dialog', { name: 'Supprimer le groupe' });
  assert.match(dialog.textContent, /Ses 2 cosmos et leurs mini-cosmos seront conservés dans LOGOS/);
  assert.equal(document.activeElement, within(dialog).getByRole('button', { name: 'Annuler' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
  assert.deepEqual(savedCosmosData(controller), before);
  chooseGroupAction(ui, 'RÉSERVE', 'Supprimer');
  dialog = ui.getByRole('dialog', { name: 'Supprimer le groupe' });
  const remove = within(dialog).getByRole('button', { name: 'Supprimer', exact: true });
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(remove.disabled, true);
  fireEvent.submit(remove.form);
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(remove);
  assert.equal(ui.queryByRole('dialog'), null);
  assert.equal(ui.queryByRole('button', { name: 'Actions du groupe RÉSERVE' }), null);
  assert.equal(controller.state.sectionDe.ATELIER, undefined);
  assert.equal(controller.state.sectionDe.VIDE, undefined);
  assert.equal(controller.state.sectionDe.TRAVAIL, 'g1');
  assert.deepEqual(controller.state.sections, before.sections.filter(x => x.id !== 'g2'));
  assert.deepEqual(controller.state.rows, before.miniCosmos);
  assert.deepEqual(controller.state.titresDe, before.titresDe);
  assert.deepEqual(controller.state.etageDe, before.etageDe);
  assert.deepEqual([...controller.state.cosmos].sort(), [...before.cosmos].sort());
  const logos = ui.getByRole('table', { name: 'Tableau LOGOS' });
  const headers = Array.from(logos.querySelectorAll('.ct-section-row, .ct-cosmos-row'));
  assert.ok(headers[0].contains(ui.getByRole('button', { name: 'Replier le cosmos ATELIER' })));
  assert.ok(headers[1].contains(ui.getByRole('button', { name: 'Replier le cosmos VIDE' })));
  assert.ok(headers[2].contains(ui.getByRole('button', { name: 'Replier le groupe PROJETS' })));
  assert.equal(controller.pollState(), controller.state);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).sections, controller.state.sections);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos groupes : actions sur groupe vide, filtres, lecture seule et nettoyage de dialogue', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const trigger = () => ui.getByRole('button', { name: 'Actions du groupe GROUPE VIDE' });
  for (const flag of ['syncRefreshing', 'needsLogin']) {
    act(() => controller.setState({ [flag]: true }));
    assert.equal(trigger().disabled, true);
    act(() => controller.setState({ [flag]: false }));
  }
  fireEvent.change(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }), { target: { value: 'GROUPE VIDE' } });
  chooseGroupAction(ui, 'GROUPE VIDE', 'Modifier');
  const input = ui.getByRole('textbox', { name: 'Nom du groupe' });
  fireEvent.change(input, { target: { value: 'NOUVEAU NOM' } });
  fireEvent.submit(input.form);
  assert.equal(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }).value, '');
  assert.ok(ui.getByRole('button', { name: 'Actions du groupe NOUVEAU NOM' }));
  chooseGroupAction(ui, 'NOUVEAU NOM', 'Supprimer');
  const remove = within(ui.getByRole('dialog', { name: 'Supprimer le groupe' })).getByRole('button', { name: 'Supprimer', exact: true });
  fireEvent.click(remove);
  assert.equal(controller.state.sections.some(x => x.id === 'g4'), false);
  chooseGroupAction(ui, 'PROJETS', 'Modifier');
  act(() => controller.deleteSection('g1'));
  assert.equal(ui.queryByRole('textbox', { name: 'Nom du groupe' }), null);
  assert.equal(controller.state.groupAction, null);
  assert.equal(controller.state.sections.some(x => x.id === 'g1'), false);
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.groupAction, null);
  assert.equal(controller.state.sectionError, '');
  assert.equal(controller.pollState(), controller.state);
});

test('cosmos tableau : création de groupes depuis les trois en-têtes, repliés ou filtrés, avec sauvegarde', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  const before = savedCosmosData(controller);
  const plis = JSON.stringify(controller.state.plis);
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  const status = ui.getByRole('combobox', { name: 'Filtrer par statut' });
  for (const floor of ['ETHOS', 'LOGOS', 'PATHOS']) {
    fireEvent.change(query, { target: { value: 'introuvable' } });
    fireEvent.change(status, { target: { value: 'Pause' } });
    const button = ui.getByRole('button', { name: 'Ajouter un groupe dans ' + floor });
    assert.ok(button.closest('.ct-floor-heading'));
    fireEvent.click(button);
    assert.ok(ui.getByRole('table', { name: 'Tableau ' + floor }));
    const form = ui.getByRole('form', { name: 'Créer un groupe dans ' + floor });
    const input = within(form).getByRole('textbox', { name: 'Nom du groupe dans ' + floor });
    assert.equal(document.activeElement, input);
    assert.equal(controller.pollState(), null);
    assert.equal(within(form).getByRole('button', { name: 'Créer', exact: true }).disabled, true);
    fireEvent.change(input, { target: { value: '  Nouveau ' + floor + '  ' } });
    fireEvent.click(button);
    assert.equal(document.activeElement, input);
    assert.equal(input.value, '  Nouveau ' + floor + '  ');
    fireEvent.submit(form);
    assert.equal(ui.queryByRole('form', { name: /^Créer un groupe/ }), null);
    assert.equal(document.activeElement, button);
    assert.equal(query.value, '');
    assert.equal(status.value, 'Tous');
    const table = within(ui.getByRole('table', { name: 'Tableau ' + floor }));
    assert.ok(table.getByRole('button', { name: 'Déplier le groupe Nouveau ' + floor }));
    assert.equal(controller.state.sections.find(x => x.name === 'Nouveau ' + floor).etage, floor.toLowerCase());
    assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).sections, controller.state.sections);
  }
  assert.equal(controller.state.sections.length, 3);
  assert.deepEqual(controller.state.rows, before.miniCosmos);
  assert.deepEqual(controller.state.cosmos, before.cosmos);
  assert.deepEqual(controller.state.sectionDe, before.sectionDe);
  assert.equal(JSON.stringify(controller.state.plis), plis);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : validation, lecture seule, annulation et nettoyage de la création de groupe', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos');
  act(() => controller.setState({ sections: [{ id: 'existing', name: 'Fondations', etage: 'ethos' }] }));
  const before = savedCosmosData(controller);
  const open = () => fireEvent.click(ui.getByRole('button', { name: 'Ajouter un groupe dans ETHOS' }));
  const form = () => ui.getByRole('form', { name: 'Créer un groupe dans ETHOS' });
  open();
  const input = ui.getByRole('textbox', { name: 'Nom du groupe dans ETHOS' });
  fireEvent.change(input, { target: { value: ' fondations ' } });
  fireEvent.submit(form());
  assert.match(ui.getByRole('alert').textContent, /existe déjà/);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.change(input, { target: { value: 'Un groupe' } });
  assert.equal(ui.queryByRole('alert'), null);
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(input.disabled, true);
  assert.equal(ui.getByRole('button', { name: 'Ajouter un groupe dans LOGOS' }).disabled, true);
  fireEvent.submit(form());
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.equal(controller.state.editSection, null);
  assert.equal(ui.queryByRole('form', { name: /^Créer un groupe/ }), null);
  assert.equal(document.activeElement, ui.getByRole('button', { name: 'Ajouter un groupe dans ETHOS' }));
  open();
  assert.equal(ui.getByRole('textbox', { name: 'Nom du groupe dans ETHOS' }).value, '');
  fireEvent.click(within(form()).getByRole('button', { name: 'Annuler', exact: true }));
  assert.deepEqual(savedCosmosData(controller), before);
  open();
  fireEvent.change(ui.getByRole('textbox', { name: 'Nom du groupe dans ETHOS' }), { target: { value: 'Abandonné' } });
  assert.equal(ui.getByRole('button', { name: 'Déplacer le cosmos TRAVAIL' }).disabled, true);
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.editSection, null);
  assert.deepEqual(savedCosmosData(controller), before);
});

test('cosmos en-têtes : toute la ligne replie les étages, groupes et cosmos sans interférer avec leurs commandes', async t => {
  const { ui, controller } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  for (const floor of ['ETHOS', 'LOGOS', 'PATHOS']) {
    const button = ui.getByRole('button', { name: floorTitles[floor], exact: true });
    const header = button.closest('.ct-floor-heading');
    fireEvent.click(header);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    assert.equal(JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open.includes('floor:' + floor.toLowerCase()), false);
    fireEvent.click(header.querySelector('.ct-floor-count'));
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    fireEvent.click(button.querySelector('.ct-floor-chevron'));
    assert.equal(button.getAttribute('aria-expanded'), 'false', 'un clic sur le bouton ne bascule pas deux fois');
    fireEvent.click(button);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    fireEvent.click(within(header).getByRole('button', { name: 'Ajouter un groupe dans ' + floor }));
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    const form = ui.getByRole('form', { name: 'Créer un groupe dans ' + floor });
    fireEvent.click(within(form).getByRole('button', { name: 'Annuler' }));
  }
  for (const cosmos of ['TRAVAIL', 'VIDE']) {
    const button = () => ui.getByRole('button', { name: new RegExp('^(Replier|Déplier) le cosmos ' + cosmos + '$') });
    const header = button().closest('tr');
    fireEvent.click(header.querySelector('td'));
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    assert.equal(ui.queryByRole('textbox', { name: 'Nouveau mini-cosmos dans ' + cosmos }), null);
    assert.equal(JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open.includes('cosmos:' + cosmos), false);
    fireEvent.click(header.querySelector('th'));
    assert.equal(button().getAttribute('aria-expanded'), 'true');
    assert.ok(ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans ' + cosmos }));
    fireEvent.click(button().querySelector('.ct-node-count'));
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    const saved = localStorage.getItem('cosmos-test-plis-v1');
    fireEvent.click(within(header).getByRole('button', { name: 'Déplacer le cosmos ' + cosmos }));
    chooseCosmosAction(ui, cosmos, 'Modifier');
    assert.equal(button().getAttribute('aria-expanded'), 'false');
    fireEvent.click(within(ui.getByRole('dialog', { name: 'Modifier le cosmos' })).getByRole('button', { name: 'Annuler' }));
    assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
    fireEvent.click(button());
    assert.equal(button().getAttribute('aria-expanded'), 'true');
  }
  const groupButton = () => ui.getByRole('button', { name: /^(Replier|Déplier) le groupe PROJETS$/ });
  const groupRow = groupButton().closest('tr');
  fireEvent.click(groupRow.querySelector('td'));
  assert.equal(groupButton().getAttribute('aria-expanded'), 'false');
  assert.equal(ui.queryByRole('button', { name: 'Actions du cosmos TRAVAIL' }), null);
  fireEvent.click(groupRow.querySelector('th'));
  assert.equal(groupButton().getAttribute('aria-expanded'), 'true');
  fireEvent.click(groupButton().querySelector('.ct-node-count'));
  assert.equal(groupButton().getAttribute('aria-expanded'), 'false');
  const saved = localStorage.getItem('cosmos-test-plis-v1');
  fireEvent.click(within(groupRow).getByRole('button', { name: 'Déplacer le groupe PROJETS' }));
  chooseGroupAction(ui, 'PROJETS', 'Modifier');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
  fireEvent.click(within(ui.getByRole('form', { name: 'Modifier le groupe' })).getByRole('button', { name: 'Annuler' }));
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
  const emptyRow = ui.getByRole('button', { name: 'Actions du groupe GROUPE VIDE' }).closest('tr');
  fireEvent.click(emptyRow.querySelector('td'));
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
  beginCosmosDrag(ui, 'le groupe PROJETS');
  fireEvent.click(groupRow);
  const cosmosButton = ui.getByRole('button', { name: 'Replier le cosmos ATELIER' });
  fireEvent.click(cosmosButton.closest('tr'));
  assert.equal(cosmosButton.getAttribute('aria-expanded'), 'true');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).closest('.ct-floor-heading'));
  assert.equal(groupButton().getAttribute('aria-expanded'), 'false');
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).getAttribute('aria-expanded'), 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
  assert.deepEqual(savedCosmosData(controller), before);
});

test('cosmos plis : fermé par défaut, ouvertures mémorisées après navigation et rechargement, nouveaux éléments fermés', async t => {
  let { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  act(() => controller.setState({
    sections: [{ id: 'g1', name: 'PROJETS', etage: 'logos' }],
    sectionDe: { TRAVAIL: 'g1' },
  }));
  const originalPlis = JSON.stringify(controller.state.plis);
  const before = savedCosmosData(controller);
  assert.equal(ui.queryAllByRole('table').length, 0);
  for (const floor of ['ETHOS', 'LOGOS', 'PATHOS'])
    assert.equal(ui.getByRole('button', { name: floorTitles[floor], exact: true }).getAttribute('aria-expanded'), 'false');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  assert.equal(ui.queryByRole('button', { name: 'Déplier le cosmos TRAVAIL' }), null);
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.equal(ui.queryByText('Projet de test'), null);
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.ok(ui.getByText('Projet de test'));
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open.sort(), ['cosmos:TRAVAIL', 'floor:logos', 'section:g1']);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.queryAllByRole('table').length, 0);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(ui.getByText('Projet de test'), 'fermer un étage conserve les ouvertures de ses enfants');
  assert.deepEqual(savedCosmosData(controller), before);
  assert.equal(JSON.stringify(controller.state.plis), originalPlis);
  ui.unmount();
  router.dispose();
  ({ ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false, clearStorage: false }));
  assert.ok(ui.getByText('Projet de test'));
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).getAttribute('aria-expanded'), 'false');
  act(() => controller.setState({ cosmos: [...controller.state.cosmos, 'NOUVEAU'] }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos NOUVEAU' }));
  assert.equal(ui.queryByRole('textbox', { name: 'Nouveau mini-cosmos dans NOUVEAU' }), null);
  chooseCosmosAction(ui, 'TRAVAIL', 'Modifier');
  const input = ui.getByRole('textbox', { name: 'Nom du cosmos' });
  fireEvent.change(input, { target: { value: 'RENOMMÉ' } });
  fireEvent.submit(input.form);
  const persisted = JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open;
  assert.ok(persisted.includes('cosmos:RENOMMÉ'));
  assert.equal(persisted.includes('cosmos:TRAVAIL'), false);
  assert.ok(ui.getByText('Projet de test'));
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.getAllByRole('table').length, 3);
  assert.ok(ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans NOUVEAU' }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.queryAllByRole('table').length, 0);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open, []);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos plis : les filtres et le survol temporaire ne remplacent pas les préférences ; stockage défectueux toléré', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  const saved = localStorage.getItem('cosmos-test-plis-v1');
  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  fireEvent.change(query, { target: { value: 'Projet de test' } });
  assert.ok(ui.getByText('Projet de test'));
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), saved);
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser', exact: true }));
  assert.equal(ui.queryAllByRole('table').length, 0);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  const beforeDrag = localStorage.getItem('cosmos-test-plis-v1');
  const drag = beginCosmosDrag(ui, 'le cosmos TRAVAIL');
  cosmosDragEvent(cosmosTarget(ui, { type: 'floor', id: 'ethos' }), 'dragover', drag.dataTransfer);
  await act(async () => new Promise(resolve => setTimeout(resolve, 650)));
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).getAttribute('aria-expanded'), 'true');
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), beforeDrag);
  fireEvent.keyDown(document, { key: 'Escape' });
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).getAttribute('aria-expanded'), 'false');
  await act(async () => router.navigate('/journal'));
  localStorage.setItem('cosmos-test-plis-v1', 'invalid JSON');
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.queryAllByRole('table').length, 0);
  const setItem = dom.window.Storage.prototype.setItem;
  t.mock.method(dom.window.Storage.prototype, 'setItem', function (key, value) {
    if (key === 'cosmos-test-plis-v1') throw new Error('Stockage indisponible');
    return setItem.call(this, key, value);
  });
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(ui.getByRole('table', { name: 'Tableau LOGOS' }));
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.ok(ui.getByText('Projet de test'));
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : les trois étages gardent leurs cosmos vides et leurs regroupements', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos');
  act(() => controller.setState({
    cosmos: ['CALME', 'TRAVAIL', 'PLATEAU FROMAGE', 'BUFFET', 'FAMILLE'],
    etageDe: { CALME: 'ethos', TRAVAIL: 'logos', 'PLATEAU FROMAGE': 'logos', BUFFET: 'logos', FAMILLE: 'pathos' },
    sections: [
      { id: 'projets', name: 'PROJETS', etage: 'logos' },
      { id: 'food', name: 'FOOD', etage: 'logos' },
      { id: 'formation', name: 'FORMATION', etage: 'logos' },
    ],
    sectionDe: { TRAVAIL: 'projets', 'PLATEAU FROMAGE': 'food', BUFFET: 'food' },
    rows: [
      { ...row, titre: 'LANCEMENT', sas: '—', actuel: '0' },
      { ...row, id: 'mc-second', name: 'Autre projet', pause: true },
    ],
  }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.equal(controller.state.view, 'table');
  const readKpis = () => Array.from(ui.getByRole('group', { name: 'Indicateurs Cosmos' }).children, item => ({
    value: item.firstElementChild.textContent,
    label: item.lastElementChild.textContent,
    color: item.firstElementChild.style.color,
    title: item.title,
  }));
  const kpis = readKpis();
  assert.deepEqual(kpis.map(({ label, value }) => ({ label, value })), controller.renderVals().kpiCards.map(({ label, value }) => ({ label, value })));
  assert.deepEqual(kpis.map(item => item.label), ['cosmos', 'mini-cosmos', 'SAS', 'pause', 'datés', 'mandats', 'tension', 'retard']);
  assert.equal(ui.queryByText('Une vue, trois tableaux.'), null);
  assert.equal(ui.queryByText('ESSAI', { exact: true }), null);
  assert.equal(ui.queryByRole('link', { name: 'Retour à Cosmos' }), null);
  const search = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  fireEvent.change(search, { target: { value: 'Introuvable' } });
  assert.deepEqual(readKpis(), kpis, 'le bandeau reste global quand le tableau est filtré');
  fireEvent.change(search, { target: { value: '' } });
  assert.equal(ui.getAllByRole('table').length, 3);
  assert.deepEqual(ui.getAllByRole('heading', { level: 2 }).map(node => node.textContent.replace('▾', '').trim()), [floorTitles.PATHOS, floorTitles.ETHOS, floorTitles.LOGOS]);
  const logos = within(ui.getByRole('table', { name: 'Tableau LOGOS' }));
  assert.equal(logos.getAllByRole('columnheader').length, 10);
  assert.equal(logos.getAllByRole('columnheader')[0].textContent, 'Groupe / Cosmos / Mini-cosmos');
  const sectionButton = () => logos.getByRole('button', { name: /^(Replier|Déplier) le groupe PROJETS$/ });
  const cosmosButton = () => logos.getByRole('button', { name: /^(Replier|Déplier) le cosmos TRAVAIL$/ });
  assert.equal(sectionButton().closest('th').cellIndex, 0);
  assert.equal(cosmosButton().closest('th').cellIndex, 0);
  assert.equal(logos.getByRole('button', { name: 'Développer les textes de Projet de test' }).closest('th').cellIndex, 0);
  assert.equal(logos.getByRole('button', { name: /^(Replier|Déplier) le cosmos BUFFET$/ }).disabled, false, 'un cosmos vide peut être ouvert pour créer son premier mini-cosmos');
  assert.equal(logos.getByRole('button', { name: /^(Replier|Déplier) le groupe FORMATION$/ }).disabled, true);
  assert.equal(logos.getAllByText('Aucun mini-cosmos').length, 2);
  assert.ok(logos.getByText('FORMATION'));
  assert.ok(logos.getByText('0'));
  assert.equal(logos.queryByText('SAS · —'), null);

  const stableData = () => {
    const { exportedAt, view, ...data } = controller.serialize();
    return JSON.parse(JSON.stringify(data));
  };
  const before = stableData();
  const plis = JSON.stringify(controller.state.plis);
  fireEvent.click(cosmosButton());
  assert.equal(cosmosButton().getAttribute('aria-expanded'), 'false');
  assert.equal(logos.queryByText('Projet de test'), null);
  fireEvent.click(sectionButton());
  assert.equal(sectionButton().getAttribute('aria-expanded'), 'false');
  assert.equal(logos.queryByText('TRAVAIL'), null);
  assert.ok(logos.getByText('BUFFET'), 'replier un groupe conserve les autres groupes');
  fireEvent.click(sectionButton());
  assert.equal(cosmosButton().getAttribute('aria-expanded'), 'false', 'le groupe conserve le repli de son cosmos');
  assert.equal(logos.queryByText('Projet de test'), null);
  fireEvent.click(cosmosButton());
  assert.ok(logos.getByText('Projet de test'));
  assert.ok(logos.getByText('Autre projet'));
  fireEvent.click(logos.getByRole('button', { name: 'Développer les textes de Projet de test' }));
  assert.equal(logos.getByRole('button', { name: 'Réduire les textes de Projet de test' }).getAttribute('aria-expanded'), 'true');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.equal(ui.queryByRole('table', { name: 'Tableau LOGOS' }), null);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(ui.getByRole('button', { name: 'Réduire les textes de Projet de test' }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  assert.equal(ui.queryAllByRole('table').length, 0);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.equal(ui.queryByText('Projet de test'), null);
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  assert.equal(ui.getAllByRole('table').length, 3);
  assert.ok(ui.getByText('Projet de test'));
  assert.ok(ui.getByText('BUFFET'));
  assert.equal(JSON.stringify(controller.state.plis), plis, 'le repli de l’cosmos reste indépendant de la page Cosmos');
  assert.deepEqual(stableData(), before, 'l’cosmos ne modifie ni les données ni le journal');
  fireEvent.click(ui.getByRole('link', { name: 'Journal', exact: true }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/journal'));
  fireEvent.click(ui.getByRole('link', { name: 'Cosmos', exact: true }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos'));
  assert.equal(controller.state.view, 'table');
  assert.deepEqual(stableData(), before);
  assert.deepEqual(readKpis(), kpis, 'mêmes valeurs, couleurs et infobulles sur la page Cosmos après navigation');
});

test('cosmos tableau : les rubriques regroupent les mini-cosmos sans répétition ni modification des données', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos');
  act(() => controller.setState({
    titresDe: { TRAVAIL: ['Enfants', 'Carole', 'PA', 'Vide'] },
    rows: [
      { ...row, id: 'couple', name: 'Couple', titre: 'Carole', pause: true },
      { ...row, id: 'matin', name: 'Matin Léon', titre: 'Enfants' },
      { ...row, id: 'libre', name: 'Sans rubrique' },
      { ...row, id: 'vacances', name: 'Vacances Sénégal', titre: 'PA' },
      { ...row, id: 'ecole', name: 'Scolarité Léon', titre: 'Enfants' },
      { ...row, id: 'autre', name: 'Autre activité', titre: 'Non répertoriée' },
    ],
  }));
  const stableData = () => {
    const { exportedAt, view, ...data } = controller.serialize();
    return JSON.parse(JSON.stringify(data));
  };
  const before = stableData();
  const table = ui.getByRole('table', { name: 'Tableau LOGOS' });
  const logos = within(table);
  const displayedOrder = () => Array.from(table.querySelectorAll('.ct-rubrique-row, .ct-mini-row'), tr =>
    tr.querySelector('.ct-rubrique-tag, .ct-mini-button > span:nth-child(2)').textContent);
  const expected = ['Sans rubrique', 'Enfants', 'Matin Léon', 'Scolarité Léon', 'Carole', 'Couple', 'PA', 'Vacances Sénégal', 'Vide', 'Non répertoriée', 'Autre activité'];
  assert.deepEqual(displayedOrder(), expected);
  assert.equal(logos.getAllByText('Enfants', { exact: true }).length, 1);
  assert.ok(logos.getByText('Vide', { exact: true }), 'les séparations vides restent visibles hors filtres');
  assert.equal(table.querySelectorAll('.ct-internal-title').length, 0);
  for (const tr of table.querySelectorAll('.ct-rubrique-row')) {
    assert.equal(tr.cells[0].cellIndex, 0);
    assert.equal(tr.cells[1].colSpan, 9);
    assert.equal(tr.querySelector('.ct-node-button'), null, 'aucun accordéon supplémentaire');
    assert.ok(tr.querySelector('[data-rubrique-actions]'), 'actions disponibles sur la séparation');
  }
  fireEvent.click(logos.getByText('Enfants', { exact: true }));
  assert.equal(router.state.location.pathname, '/cosmos', 'le titre de rubrique n’ouvre pas de fiche');
  fireEvent.click(logos.getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  assert.deepEqual(displayedOrder(), []);
  fireEvent.click(logos.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.deepEqual(displayedOrder(), expected);

  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  fireEvent.change(query, { target: { value: 'scolarite' } });
  assert.deepEqual(displayedOrder(), ['Enfants', 'Scolarité Léon']);
  fireEvent.change(query, { target: { value: 'enfants' } });
  assert.deepEqual(displayedOrder(), ['Enfants', 'Matin Léon', 'Scolarité Léon']);
  fireEvent.change(query, { target: { value: '' } });
  fireEvent.change(ui.getByRole('combobox', { name: 'Filtrer par statut' }), { target: { value: 'Pause' } });
  assert.deepEqual(displayedOrder(), ['Carole', 'Couple']);
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser', exact: true }));
  assert.deepEqual(displayedOrder(), expected);
  assert.deepEqual(stableData(), before, 'le regroupement et les filtres ne sauvegardent aucune modification');

  const originalRows = controller.state.rows;
  act(() => controller.setState({ titresDe: { TRAVAIL: ['PA', 'Carole', 'Enfants'] } }));
  assert.deepEqual(displayedOrder(), ['Sans rubrique', 'PA', 'Vacances Sénégal', 'Carole', 'Couple', 'Enfants', 'Matin Léon', 'Scolarité Léon', 'Non répertoriée', 'Autre activité']);
  assert.equal(controller.state.rows, originalRows, 'actualiser l’ordre des titres ne réordonne pas les données');
});

test('cosmos tableau : recherche sans accents et statut filtrent aussi les cosmos vides sans modifier leur ordre', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  act(() => controller.setState({
    cosmos: ['TRAVAIL', 'BŒUF'],
    etageDe: { TRAVAIL: 'logos', 'BŒUF': 'logos' },
    sections: [{ id: 'food', name: 'ÉLEVAGE', etage: 'logos' }],
    sectionDe: { 'BŒUF': 'food' },
    rows: [row, { ...row, id: 'mc-pause', name: 'Projet en pause', pause: true }],
  }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  const status = ui.getByRole('combobox', { name: 'Filtrer par statut' });
  const table = () => within(ui.getByRole('table', { name: 'Tableau LOGOS' }));
  assert.equal(ui.queryByText('Sans groupe', { exact: true }), null);
  assert.equal(ui.queryByRole('button', { name: /le groupe Sans groupe$/ }), null);
  assert.deepEqual(
    Array.from(ui.getByRole('table', { name: 'Tableau LOGOS' }).querySelectorAll('.ct-node-name'), node => node.textContent),
    ['TRAVAIL', 'ÉLEVAGE', 'BŒUF'],
    'les cosmos sans groupe précèdent directement les groupes nommés',
  );
  fireEvent.change(query, { target: { value: 'elevage' } });
  assert.ok(table().getByText('BŒUF'));
  assert.ok(table().getByText('Aucun mini-cosmos'));
  assert.equal(table().queryByText('TRAVAIL'), null);
  fireEvent.change(query, { target: { value: 'boeuf' } });
  assert.ok(table().getByText('BŒUF'));
  fireEvent.change(status, { target: { value: 'Pause' } });
  assert.equal(table().queryByText('BŒUF'), null, 'un cosmos vide ne correspond pas au statut Pause');
  fireEvent.change(query, { target: { value: '' } });
  assert.ok(table().getByText('Projet en pause'));
  assert.equal(table().queryByText('Projet de test'), null);
  assert.ok(table().getByText('1 mini-cosmos'));
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser', exact: true }));
  assert.ok(table().getByText('Projet de test'));
  assert.ok(table().getByText('BŒUF'));
  assert.ok(table().getByText('2 mini-cosmos'));
  fireEvent.click(table().getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  fireEvent.change(query, { target: { value: 'Projet de test' } });
  assert.ok(table().getByText('Projet de test'), 'la recherche ouvre tous les ancêtres du résultat');
  fireEvent.click(table().getByRole('button', { name: 'Replier le cosmos TRAVAIL' }));
  assert.equal(table().queryByText('Projet de test'), null, 'les accordéons restent utilisables pendant la recherche');
  fireEvent.change(query, { target: { value: 'pause' } });
  assert.ok(table().getByText('Projet en pause'), 'une nouvelle recherche révèle ses propres résultats');
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  assert.equal(ui.queryAllByRole('table').length, 0);
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.ok(table().getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }), 'le cosmos sans groupe reste accessible après Tout fermer');
  fireEvent.click(table().getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
  assert.ok(table().getByText('Projet en pause'));
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  assert.ok(table().getByText('Projet en pause'));
  assert.equal(table().queryByText('Projet de test'), null, 'Tout ouvrir conserve les filtres');
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser', exact: true }));
  assert.equal(ui.queryByRole('table', { name: 'Tableau LOGOS' }), null, 'effacer les filtres restaure le repli de l’étage');
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS, exact: true }));
  assert.equal(table().getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }).getAttribute('aria-expanded'), 'false');
  assert.equal(controller.state.rows.length, 2);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : les compteurs d’étapes distinguent absence, progression, fin et retard', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  const { daysAgo } = await import('../cosmos-core.js');
  const cases = [
    { name: 'Sans étapes', actions: [], cloture: daysAgo(2), count: '0/0', color: 'rgb(245, 158, 11)' },
    { name: 'En cours', actions: [{ text: 'A', done: true }, { text: 'B', done: false }], cloture: daysAgo(-10), count: '1/2', color: 'rgb(228, 228, 231)' },
    { name: 'Toutes faites', actions: [{ text: 'A', done: true }], cloture: daysAgo(2), count: '1/1', color: 'rgb(52, 211, 153)' },
    { name: 'En retard', actions: [{ text: 'A', done: true }, { text: 'B', done: false }], cloture: daysAgo(2), count: '1/2', color: 'rgb(251, 113, 133)' },
    { name: 'Étape sans texte', actions: [{ text: '  ', done: true }], cloture: '', draft: true, count: '0/0', color: 'rgb(245, 158, 11)' },
  ];
  act(() => controller.setState({ rows: cases.map((item, index) => ({ ...row, ...item, id: 'steps-' + index, startAt: daysAgo(20) })) }));
  for (const item of cases) {
    const badge = ui.getByRole('button', { name: new RegExp('^Étapes de ' + item.name + ' :') });
    assert.equal(badge.textContent, item.count);
    assert.equal(badge.style.color, item.color);
    assert.equal(badge.getAttribute('aria-haspopup'), 'dialog');
  }
});

test('cosmos tableau : cocher et ajouter des étapes sauvegarde sans écrire au Journal ni changer le statut', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  const before = JSON.parse(JSON.stringify(controller.state.rows[0]));
  const plis = JSON.stringify(controller.state.plis);
  const badge = () => ui.getByRole('button', { name: /^Étapes de Projet de test :/ });
  badge().focus();
  fireEvent.click(badge());
  const dialog = ui.getByRole('dialog', { name: 'Étapes de Projet de test' });
  const panel = within(dialog);
  assert.equal(panel.getByRole('checkbox', { name: 'Première étape' }).checked, false);
  fireEvent.click(panel.getByRole('checkbox', { name: 'Première étape' }));
  assert.equal(badge().textContent, '1/1');
  assert.equal(badge().style.color, 'rgb(52, 211, 153)');
  const input = panel.getByRole('textbox', { name: 'Nouvelle étape' });
  fireEvent.change(input, { target: { value: '   ' } });
  assert.equal(panel.getByRole('button', { name: 'Ajouter', exact: true }).disabled, true);
  fireEvent.submit(input.closest('form'));
  assert.equal(controller.state.rows[0].actions.length, 1);

  // L’ajout repart des étapes les plus récentes, y compris une actualisation reçue pendant l’ouverture.
  act(() => controller.update('mc-test', { actions: [...controller.state.rows[0].actions, { text: 'Étape actualisée', done: false }] }));
  assert.ok(panel.getByRole('checkbox', { name: 'Étape actualisée' }));
  fireEvent.change(input, { target: { value: '  Deuxième action  ' } });
  fireEvent.click(panel.getByRole('button', { name: 'Ajouter', exact: true }));
  assert.equal(input.value, '');
  assert.equal(document.activeElement, input);
  assert.equal(badge().textContent, '1/3');
  assert.equal(badge().style.color, 'rgb(228, 228, 231)');
  assert.ok(panel.getByRole('checkbox', { name: 'Deuxième action' }));
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos[0].actions, controller.state.rows[0].actions);

  fireEvent.change(input, { target: { value: 'Action bloquée' } });
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(input.disabled, true);
  assert.equal(panel.getByRole('checkbox', { name: 'Première étape' }).disabled, true);
  fireEvent.submit(input.closest('form'));
  assert.equal(controller.state.rows[0].actions.length, 3);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent(dialog, new dom.window.Event('cancel', { cancelable: true }));
  assert.equal(ui.queryByRole('dialog'), null);
  assert.equal(document.activeElement, badge());
  fireEvent.click(badge());
  assert.equal(ui.getByRole('textbox', { name: 'Nouvelle étape' }).value, '', 'fermer abandonne uniquement le texte non ajouté');
  fireEvent.click(ui.getByRole('button', { name: 'Fermer les étapes' }));
  assert.deepEqual({ ...controller.state.rows[0], actions: before.actions }, before);
  assert.equal(JSON.stringify(controller.state.plis), plis);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : le tag bascule Actif/Pause, sauvegarde et respecte le filtre sans écrire au Journal', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  const before = JSON.parse(JSON.stringify(controller.state.rows[0]));
  fireEvent.click(ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' }));
  assert.equal(controller.state.rows[0].pause, true);
  assert.ok(ui.getByRole('button', { name: 'Pause — Reprendre Projet de test' }));
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos[0].pause, true);
  fireEvent.click(ui.getByRole('button', { name: 'Pause — Reprendre Projet de test' }));
  assert.deepEqual(controller.state.rows[0], before);
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos[0].pause, false);
  assert.deepEqual(controller.state.journal, []);
  act(() => controller.setState({ syncRefreshing: true }));
  const tag = ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' });
  assert.equal(tag.disabled, true);
  fireEvent.click(tag);
  assert.deepEqual(controller.state.rows[0], before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.change(ui.getByRole('combobox', { name: 'Filtrer par statut' }), { target: { value: 'Actif' } });
  fireEvent.click(ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' }));
  assert.equal(ui.queryByRole('button', { name: 'Pause — Reprendre Projet de test' }), null);
  assert.equal(controller.state.rows.length, 1, 'le mini-cosmos est seulement masqué par le filtre');
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser', exact: true }));
  assert.ok(ui.getByRole('button', { name: 'Pause — Reprendre Projet de test' }));
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : la reprise conserve le SAS et valide les brouillons ; les statuts programmés ou clôturés sont protégés', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  const { daysAgo } = await import('../cosmos-core.js');
  act(() => controller.setState({ rows: [
    { ...row, id: 'sas', name: 'Essai SAS', sas: 'Tester', sasUntil: daysAgo(-5), startAt: daysAgo(2), cloture: daysAgo(-20), pause: false, sasDone: false },
    { ...row, id: 'future', name: 'Planifié', startAt: daysAgo(-5), cloture: daysAgo(-20), pause: false },
    { ...row, id: 'closed', name: 'Terminé', closed: true, closedAt: daysAgo(1) },
    { ...row, id: 'draft', name: 'Brouillon', draft: true, pause: true, entropie: '', reponse: '', startAt: '', cloture: '', actions: [] },
  ] }));
  const sasBefore = JSON.parse(JSON.stringify(controller.state.rows[0]));
  fireEvent.click(ui.getByRole('button', { name: 'SAS — Mettre en pause Essai SAS' }));
  assert.equal(ui.getByRole('button', { name: 'Pause — Reprendre Essai SAS' }).title, 'Reprendre le SAS');
  fireEvent.click(ui.getByRole('button', { name: 'Pause — Reprendre Essai SAS' }));
  assert.ok(ui.getByRole('button', { name: 'SAS — Mettre en pause Essai SAS' }));
  assert.deepEqual(controller.state.rows[0], sasBefore);
  for (const name of ['Pause — Planifié', 'Clôturé — Terminé']) {
    const tag = ui.getByRole('button', { name });
    assert.equal(tag.disabled, true);
    const rowsBefore = JSON.stringify(controller.state.rows);
    fireEvent.click(tag);
    assert.equal(JSON.stringify(controller.state.rows), rowsBefore);
  }
  fireEvent.click(ui.getByRole('button', { name: 'Pause — Reprendre Brouillon' }));
  assert.equal(controller.state.rows[3].pause, true);
  assert.equal(controller.state.rows[3].draft, true);
  assert.match(controller.state.editError, /entropie/);
  assert.ok(ui.getByText(/À compléter avant de reprendre/));
  act(() => controller.update('draft', { entropie: 'Risque', reponse: 'Réponse', startAt: daysAgo(0), cloture: daysAgo(-20) }));
  fireEvent.click(ui.getByRole('button', { name: 'Pause — Reprendre Brouillon' }));
  assert.ok(ui.getByRole('button', { name: 'Actif — Mettre en pause Brouillon' }));
  assert.equal(controller.state.rows[3].draft, false);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : le clic de ligne ouvre la fiche latérale et conserve les filtres lors de la fermeture et du retour arrière', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos');
  const before = JSON.stringify(controller.state.rows);
  fireEvent.change(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }), { target: { value: 'Projet' } });
  fireEvent.click(ui.getByRole('button', { name: 'Développer les textes de Projet de test' }));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }));
  fireEvent.click(ui.getByText('Objectif initial'));
  await ui.findByRole('button', { name: 'Modifier', exact: true });
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos/mc-test'));
  assert.equal(controller.state.selected, 'mc-test');
  assert.equal(controller.state.view, 'table');
  fireEvent.click(ui.getByRole('button', { name: 'Fermer', exact: true }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos'));
  assert.equal(controller.state.selected, null);
  assert.equal(ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' }).value, 'Projet');
  assert.equal(ui.getByRole('button', { name: 'Réduire les textes de Projet de test' }).getAttribute('aria-expanded'), 'true');
  assert.equal(ui.getByRole('button', { name: floorTitles.ETHOS, exact: true }).getAttribute('aria-expanded'), 'false');
  fireEvent.click(ui.getByRole('button', { name: 'Ouvrir la fiche de Projet de test' }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos/mc-test'));
  await act(() => router.navigate(-1));
  assert.equal(controller.state.selected, null);
  assert.equal(ui.queryByRole('button', { name: 'Modifier', exact: true }), null);
  await act(() => router.navigate(1));
  await ui.findByRole('button', { name: 'Modifier', exact: true });
  assert.equal(controller.state.selected, 'mc-test');
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos'));
  assert.equal(JSON.stringify(controller.state.rows), before);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : une URL de fiche fonctionne directement et les actions de ligne n’ouvrent pas le volet', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos/mc-test');
  await ui.findByRole('button', { name: 'Modifier', exact: true });
  assert.equal(controller.state.view, 'table');
  assert.equal(controller.state.selected, 'mc-test');
  fireEvent.click(ui.getByRole('button', { name: 'Fermer', exact: true }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/cosmos'));
  fireEvent.click(ui.getByRole('button', { name: 'Actif — Mettre en pause Projet de test' }));
  assert.equal(controller.state.rows[0].pause, true);
  assert.equal(controller.state.selected, null);
  fireEvent.click(ui.getByRole('button', { name: /^Étapes de Projet de test :/ }));
  assert.ok(ui.getByRole('dialog', { name: 'Étapes de Projet de test' }));
  assert.equal(controller.state.selected, null);
  fireEvent.click(ui.getByRole('button', { name: 'Fermer les étapes' }));
  fireEvent.click(ui.getByRole('button', { name: 'Développer les textes de Projet de test' }));
  assert.equal(controller.state.selected, null);
  assert.equal(router.state.location.pathname, '/cosmos');
  assert.equal(ui.queryByRole('button', { name: 'Modifier', exact: true }), null);
});

test('les quatre pages fonctionnent avec les liens React Router et le retour arrière', async (t) => {
  const { ui, controller, router } = await mount(t);
  assert.ok(ui.getByText('Projet de test'));
  for (const [label, path, view] of [
    ['Échéances', '/echeances', 'echeances'],
    ['Modèles', '/modeles', 'templates'],
    ['Journal', '/journal', 'journal'],
  ]) {
    fireEvent.click(ui.getByRole('link', { name: label }));
    await waitFor(() => {
      assert.equal(router.state.location.pathname, path);
      assert.equal(controller.state.view, view);
    });
  }
  await act(() => router.navigate(-1));
  assert.equal(controller.state.view, 'templates');
  await act(() => router.navigate(-1));
  assert.equal(controller.state.view, 'echeances');
});

test('une URL de fiche ouvre le volet, puis sa fermeture retire l’identifiant de la route', async (t) => {
  const { ui, controller, router } = await mount(t, '/echeances/mc-test');
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Modifier' })));
  assert.equal(controller.state.selected, 'mc-test');
  assert.equal(controller.state.view, 'echeances');
  await act(() => controller.renderVals().closeDetail());
  await waitFor(() => assert.equal(router.state.location.pathname, '/echeances'));
  assert.equal(controller.state.selected, null);
});

test('changer de page bloque un brouillon invalide puis enregistre un brouillon valide une seule fois', async (t) => {
  const { ui, controller, router } = await mount(t, '/cosmos/mc-test');
  await waitFor(() => assert.ok(ui.getByRole('button', { name: 'Modifier' })));
  fireEvent.click(ui.getByRole('button', { name: 'Modifier' }));
  const name = ui.getByDisplayValue('Projet de test');
  fireEvent.change(name, { target: { value: '' } });
  fireEvent.click(ui.getByRole('link', { name: 'Journal' }));
  await waitFor(() => assert.ok(controller.state.editError));
  assert.equal(router.state.location.pathname, '/cosmos/mc-test');
  assert.equal(controller.state.editing, true);
  fireEvent.change(name, { target: { value: 'Projet renommé' } });
  fireEvent.click(ui.getByRole('link', { name: 'Journal' }));
  await waitFor(() => assert.equal(router.state.location.pathname, '/journal'));
  assert.equal(controller.state.rows[0].name, 'Projet renommé');
  assert.equal(controller.state.journal.length, 0);
  assert.equal(controller.state.editing, false);
});

test('les listes déroulantes des échéances gardent leurs options et filtrent les lignes', async (t) => {
  const { ui, controller } = await mount(t, '/echeances');
  const month = ui.getByTitle("Mois de l'échéance");
  assert.ok(within(month).getByRole('option', { name: 'déc. 2027' }));
  fireEvent.change(month, { target: { value: '2027-12' } });
  assert.equal(controller.state.monthFilter, '2027-12');
  assert.equal(ui.container.querySelectorAll('.echeance-row').length, 1);
  fireEvent.change(month, { target: { value: '2027-11' } });
  assert.equal(ui.container.querySelectorAll('.echeance-row').length, 0);
  fireEvent.click(ui.getByRole('button', { name: 'Réinitialiser les filtres' }));
  assert.equal(ui.container.querySelectorAll('.echeance-row').length, 1);
});

test('le formulaire React crée un mini-cosmos avec sa gouvernance et son événement', async (t) => {
  const { ui, controller } = await mount(t, '/cosmos', { openCosmos: false });
  fireEvent.click(ui.getByRole('button', { name: '+ mini-cosmos' }));
  const name = await ui.findByPlaceholderText('Projet A, Maison, Lecture…');
  fireEvent.click(ui.getByRole('button', { name: controller.renderVals().parentChips[0].label }));
  fireEvent.change(name, { target: { value: 'Nouveau projet' } });
  fireEvent.change(ui.getByPlaceholderText("Quel est l'état à atteindre ou maintenir ?"), {
    target: { value: 'Livrer le projet' },
  });
  fireEvent.click(ui.getByRole('button', { name: 'Suivant ›' }));
  fireEvent.change(ui.getByPlaceholderText('Quels sont les dangers qui guettent ce mini-cosmos ?'), {
    target: { value: 'Un retard' },
  });
  fireEvent.change(ui.getByPlaceholderText('Quelle est la parade à ce danger ?'), {
    target: { value: 'Planifier' },
  });
  fireEvent.click(ui.getByRole('button', { name: 'Suivant ›' }));
  fireEvent.click(ui.getByRole('button', { name: 'Suivant ›' }));
  const relative = [...ui.container.querySelectorAll('select')].find((s) =>
    s.textContent.includes('Jours relatifs…'),
  );
  assert.ok(relative);
  assert.ok(relative.options.length > 2);
  fireEvent.change(relative, { target: { value: relative.options[2].value } });
  const create = ui.getByRole('button', { name: 'Créer le mini-cosmos' });
  assert.equal(create.disabled, false, JSON.stringify(controller.state.form));
  fireEvent.click(create);
  assert.equal(controller.state.rows.length, 2);
  assert.equal(controller.state.rows[1].name, 'Nouveau projet');
  assert.equal(controller.state.journal.length, 0);
  assert.equal(controller.state.showMiniModal, false);
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Nouveau projet' }));
});

test('séparations : ordre continu, flèches et déplacements entre étages', async t => {
  const { controller } = await mount(t);
  act(() => controller.setState({
    cosmos: ['A', 'B', 'C', 'D'], etageDe: { A: 'logos', B: 'logos', C: 'logos', D: 'logos' }, rows: [],
    sections: [{ id: 's1', name: 'Première', etage: 'logos' }, { id: 's2', name: 'Deuxième', etage: 'logos' }, { id: 's3', name: 'Vertus', etage: 'ethos' }],
    sectionDe: { A: 's1', B: 's2', C: 's1' },
  }));
  assert.deepEqual(controller.state.cosmos, ['D', 'A', 'C', 'B']);
  assert.deepEqual(controller.renderVals().groups.map(g => g.name), ['D', 'A', 'C', 'B']);
  act(() => controller.moveCosmosBy('C', -1));
  assert.deepEqual(controller.state.cosmos, ['D', 'C', 'A', 'B']);
  act(() => controller.moveCosmosBy('C', -1));
  assert.deepEqual(controller.state.cosmos, ['D', 'C', 'A', 'B'], 'la flèche reste dans la séparation');
  act(() => controller.moveSectionBy('s2', -1));
  assert.deepEqual(controller.state.cosmos, ['D', 'B', 'C', 'A']);
  act(() => controller.moveCosmos('D', 'A'));
  assert.equal(controller.state.sectionDe.D, 's1');
  act(() => controller.assignSection('A', 's3'));
  assert.equal(controller.state.etageDe.A, 'ethos');
  assert.equal(controller.state.sectionDe.A, 's3');
  assert.equal(controller.renderVals().etages.find(e => e.etage === 'ethos').groups.some(g => g.name === 'A'), true);
  act(() => controller.moveCosmosToEtage('A', 'pathos'));
  assert.equal(controller.state.sectionDe.A, undefined);
  assert.equal(controller.renderVals().etages.find(e => e.etage === 'pathos').groups.some(g => g.name === 'A'), true);
  assert.deepEqual(controller.state.journal, []);
});

test('cosmos tableau : la dernière ligne réutilise la création rapide, sous la dernière rubrique et sans Journal', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos');
  act(() => controller.setState({ titresDe: { TRAVAIL: ['PREMIÈRE', 'DERNIÈRE'] } }));
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  const form = input.closest('form');
  assert.equal(form.closest('td').colSpan, 10);
  assert.equal(form.closest('tr').parentElement.lastElementChild, form.closest('tr'));
  assert.ok(within(form).getByText('Sous « DERNIÈRE »'));
  const before = savedCosmosData(controller);
  const plis = JSON.stringify(controller.state.plis);
  assert.equal(within(form).getByRole('button', { name: 'Créer un mini-cosmos dans TRAVAIL' }).disabled, true);
  for (const name of ['Première idée', 'Deuxième idée']) {
    fireEvent.change(input, { target: { value: '  ' + name + '  ' } });
    fireEvent.submit(form);
    const mini = controller.state.rows.at(-1);
    assert.equal(mini.name, name);
    assert.equal(mini.cosmos, 'TRAVAIL');
    assert.equal(mini.titre, 'DERNIÈRE');
    assert.equal(mini.draft, true);
    assert.equal(mini.pause, true);
    for (const field of ['objectif', 'actuel', 'entropie', 'reponse', 'alerte', 'kill', 'startAt', 'cloture']) assert.equal(mini[field], '');
    assert.deepEqual(mini.actions, []);
    assert.equal(input.value, '');
    assert.equal(document.activeElement, input);
    assert.equal(form.closest('tr').parentElement.lastElementChild, form.closest('tr'));
    assert.equal(router.state.location.pathname, '/cosmos');
  }
  assert.deepEqual(controller.state.rows[0], before.miniCosmos[0]);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos, controller.state.rows);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(JSON.stringify(controller.state.plis), plis);
  fireEvent.change(input, { target: { value: 'Première idée' } });
  fireEvent.submit(form);
  assert.equal(controller.state.rows.length, 3);
  assert.ok(within(form).getByRole('alert'));
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.equal(input.value, '');
});

test('cosmos tableau : création dans un cosmos vide, filtres et repli locaux, et blocage pendant une synchronisation', async t => {
  const { ui, controller } = await mount(t, '/cosmos');
  act(() => controller.setState({ cosmos: ['TRAVAIL', 'VIDE'], filter: 'Actif', tQuery: 'Filtre initial' }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout ouvrir', exact: true }));
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans VIDE' });
  fireEvent.change(input, { target: { value: 'Premier mini' } });
  fireEvent.click(ui.getByRole('button', { name: 'Replier le cosmos VIDE' }));
  assert.equal(ui.queryByRole('textbox', { name: 'Nouveau mini-cosmos dans VIDE' }), null);
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le cosmos VIDE' }));
  const reopened = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans VIDE' });
  assert.equal(reopened.value, 'Premier mini');
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(reopened.disabled, true);
  fireEvent.submit(reopened.form);
  assert.equal(controller.state.rows.length, 1);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.submit(reopened.form);
  assert.equal(controller.state.rows.at(-1).cosmos, 'VIDE');
  assert.equal(controller.state.rows.at(-1).titre, undefined);
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Premier mini' }));
  fireEvent.click(ui.getByRole('button', { name: 'Tout fermer', exact: true }));
  const query = ui.getByRole('searchbox', { name: 'Rechercher dans les tableaux' });
  const status = ui.getByRole('combobox', { name: 'Filtrer par statut' });
  fireEvent.change(query, { target: { value: 'Projet de test' } });
  fireEvent.change(status, { target: { value: 'Actif' } });
  const workInput = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  fireEvent.change(workInput, { target: { value: 'Visible après création' } });
  fireEvent.submit(workInput.form);
  assert.equal(query.value, '');
  assert.equal(status.value, 'Tous');
  assert.ok(ui.getByRole('button', { name: 'Ouvrir la fiche de Visible après création' }));
  assert.equal(controller.state.filter, 'Actif', 'le filtre de l’ancienne interface reste indépendant');
  assert.equal(controller.state.tQuery, 'Filtre initial');
  assert.deepEqual(controller.state.journal, []);
});

test('création rapide : nom seul, pause sans date, ajouts successifs et focus conservé', async t => {
  const { ui, controller } = await mount(t);
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  input.focus();
  fireEvent.change(input, { target: { value: '  Idée à préciser  ' } });
  fireEvent.submit(input.form);
  const created = controller.state.rows.at(-1);
  assert.equal(created.name, 'Idée à préciser');
  assert.equal(created.cosmos, 'TRAVAIL');
  assert.equal(created.titre, 'PROJETS', 'le dernier titre du tableau reçoit la nouvelle ligne');
  assert.equal(created.pause, true); assert.equal(created.draft, true);
  for (const field of ['objectif','actuel','entropie','reponse','alerte','kill','startAt','cloture','sas','sasUntil']) assert.equal(created[field], '', field);
  assert.equal(input.value, ''); assert.equal(document.activeElement, input);
  assert.ok(ui.getByText('Idée à préciser'));
  assert.equal(controller.state.showMiniModal, false);
  fireEvent.change(input, { target: { value: 'Deuxième idée' } });
  fireEvent.click(ui.getByRole('button', { name: 'Créer un mini-cosmos dans TRAVAIL' }));
  assert.equal(controller.state.rows.length, 3);
  assert.equal(new Set(controller.state.rows.map(x => x.id)).size, 3);
  assert.equal(document.activeElement, input);
  assert.deepEqual(controller.state.journal, []);
  const saved = JSON.parse(localStorage.getItem('cosmos-app-v1'));
  assert.equal(saved.miniCosmos.at(-1).cloture, '');
  const kpis = controller.renderVals().kpiCards;
  assert.equal(kpis.find(k => k.label === 'datés').value, '1');
  assert.equal(kpis.find(k => k.label === 'pause').value, '2');
});

test('création rapide : doublon, nom vide, Échap et composition ne créent pas de ligne', async t => {
  const { ui, controller } = await mount(t);
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  fireEvent.submit(input.form);
  assert.ok(ui.getByRole('alert').textContent.includes('obligatoire'));
  fireEvent.change(input, { target: { value: '  PROJET DE TEST  ' } });
  fireEvent.submit(input.form);
  assert.equal(controller.state.rows.length, 1);
  assert.ok(ui.getByRole('alert').textContent.includes('existe déjà'));
  assert.equal(input.value, '  PROJET DE TEST  ');
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.equal(input.value, ''); assert.equal(ui.queryByRole('alert'), null);
  fireEvent.change(input, { target: { value: 'En cours' } });
  assert.equal(fireEvent.keyDown(input, { key: 'Enter', isComposing: true, cancelable: true }), false);
  assert.equal(controller.state.rows.length, 1);
  assert.equal(controller.pollState(), null, 'une saisie empêche le remplacement distant du tableau');
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.notEqual(controller.pollState(), null);
});

test('création rapide : compléter progressivement puis reprendre avec une vraie échéance', async t => {
  const { ui, controller } = await mount(t);
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  fireEvent.change(input, { target: { value: 'Projet à compléter' } }); fireEvent.submit(input.form);
  const id = controller.state.rows.at(-1).id;
  fireEvent.click(ui.getByText('Projet à compléter'));
  await waitFor(() => assert.equal(controller.state.selected, id));
  assert.equal(controller.renderVals().detail.startDate, '');
  assert.equal(controller.renderVals().detail.clotureDate, '');
  assert.equal(controller.renderVals().detail.isDatee, true, 'le calendrier vide est accessible');
  fireEvent.click(ui.getByRole('button', { name: 'Reprendre', exact: true }));
  assert.equal(controller.state.rows.at(-1).pause, true);
  fireEvent.click(ui.getByRole('button', { name: 'Modifier', exact: true }));
  act(() => controller.update(id, { objectif: 'Définir le projet' }));
  act(() => assert.equal(controller.finishEdit(), true));
  assert.equal(controller.state.rows.at(-1).objectif, 'Définir le projet');
  assert.equal(controller.state.rows.at(-1).cloture, '');
  act(() => {
    controller.beginEdit(id);
    controller.update(id, { entropie: 'Dispersion', reponse: 'Choisir une priorité', cloture: '2027-09-08' });
    assert.equal(controller.finishEdit(), true);
  });
  fireEvent.click(ui.getByRole('button', { name: 'Reprendre', exact: true }));
  assert.equal(controller.state.rows.at(-1).draft, true, 'le début doit être choisi, pas déduit de la création');
  assert.match(controller.state.editError, /début/);
  act(() => {
    controller.beginEdit(id);
    controller.update(id, { entropie: 'Dispersion', reponse: 'Choisir une priorité', startAt: '2026-09-08', cloture: '2027-09-08' });
    assert.equal(controller.finishEdit(), true);
  });
  fireEvent.click(ui.getByRole('button', { name: 'Reprendre', exact: true }));
  assert.equal(controller.state.rows.at(-1).pause, false);
  assert.equal(controller.state.rows.at(-1).draft, false);
  assert.equal(controller.renderVals().detail.statut, 'Actif');
  assert.deepEqual(controller.state.journal, []);
});

test('création rapide : une fiche complétée peut démarrer plus tard et seul Actuel écrit dans le Journal', async t => {
  const { ui, controller } = await mount(t);
  const { daysAgo } = await import('../cosmos-core.js');
  const input = ui.getByRole('textbox', { name: 'Nouveau mini-cosmos dans TRAVAIL' });
  fireEvent.change(input, { target: { value: 'Projet futur' } }); fireEvent.submit(input.form);
  const id = controller.state.rows.at(-1).id;
  fireEvent.click(ui.getByText('Projet futur'));
  await waitFor(() => assert.equal(controller.state.selected, id));
  act(() => {
    controller.beginEdit(id);
    controller.update(id, { actuel: 'Premier repère', entropie: 'Dispersion', reponse: 'Choisir une priorité', startAt: daysAgo(-30), cloture: daysAgo(-90) });
    assert.equal(controller.finishEdit(), true);
  });
  fireEvent.click(ui.getByRole('button', { name: 'Reprendre', exact: true }));
  assert.equal(controller.state.rows.at(-1).pause, false);
  assert.equal(controller.state.rows.at(-1).draft, false);
  assert.equal(controller.renderVals().detail.statut, 'Pause', 'pause calculée jusqu’au début programmé');
  assert.equal(controller.state.journal.length, 1);
  assert.deepEqual(controller.state.journal[0].changes, [{ field: 'Valeur actuelle', before: '', after: 'Premier repère' }]);
});

test('cosmos espaces : modifier les trois titres, même repliés, conserve les données et les ouvertures après rechargement', async t => {
  let { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  const before = JSON.stringify({ rows: controller.state.rows, cosmos: controller.state.cosmos, etageDe: controller.state.etageDe, sections: controller.state.sections, titresDe: controller.state.titresDe });
  for (const id of ['ethos', 'logos', 'pathos']) {
    fireEvent.click(ui.getByRole('button', { name: 'Modifier le titre de ' + id.toUpperCase() }));
    const dialog = within(ui.getByRole('dialog', { name: 'Modifier le titre de l’espace' }));
    const input = dialog.getByRole('textbox', { name: 'Titre de l’espace' });
    assert.equal(input.value, floorTitles[id.toUpperCase()]);
    assert.equal(document.activeElement === input, true);
    assert.equal(controller.pollState(), null, 'la synchronisation attend la fin de la saisie');
    fireEvent.change(input, { target: { value: '  ESPACE ' + id.toUpperCase() + '  ' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => assert.equal(document.activeElement?.id, 'ct-edit-floor-' + id));
    assert.equal(ui.getByRole('button', { name: 'ESPACE ' + id.toUpperCase(), exact: true }).getAttribute('aria-expanded'), 'false');
  }
  assert.deepEqual(controller.state.titresEtages, { ethos: 'ESPACE ETHOS', logos: 'ESPACE LOGOS', pathos: 'ESPACE PATHOS' });
  assert.deepEqual(controller.serialize().titresEtages, controller.state.titresEtages);
  assert.equal(JSON.stringify({ rows: controller.state.rows, cosmos: controller.state.cosmos, etageDe: controller.state.etageDe, sections: controller.state.sections, titresDe: controller.state.titresDe }), before);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  assert.ok(controller.pollState());
  ui.unmount(); router.dispose();
  ({ ui, controller, router } = await mount(t, '/cosmos', { clearStorage: false, openCosmos: false }));
  assert.ok(ui.getByRole('heading', { name: 'ESPACE ETHOS' }));
  assert.ok(ui.getByRole('heading', { name: 'ESPACE LOGOS' }));
  assert.ok(ui.getByRole('heading', { name: 'ESPACE PATHOS' }));
  assert.ok(ui.getByRole('button', { name: 'Ajouter un groupe dans ESPACE LOGOS' }));
  fireEvent.click(ui.getByRole('button', { name: 'ESPACE LOGOS', exact: true }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos TRAVAIL' }));
});

test('cosmos espaces : annulation, validation, lecture seule et navigation protègent la saisie', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  const open = () => {
    fireEvent.click(ui.getByRole('button', { name: 'Modifier le titre de ETHOS' }));
    return within(ui.getByRole('dialog', { name: 'Modifier le titre de l’espace' }));
  };
  let dialog = open();
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: '   ' } });
  assert.equal(dialog.getByRole('button', { name: 'Enregistrer' }).disabled, true);
  fireEvent.submit(ui.getByRole('dialog').querySelector('form'));
  assert.ok(dialog.getByRole('alert'));
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'x'.repeat(301) } });
  fireEvent.submit(ui.getByRole('dialog').querySelector('form'));
  assert.ok(dialog.getByRole('alert'));
  fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
  assert.deepEqual(controller.state.titresEtages, {});
  dialog = open();
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'Brouillon annulé' } });
  fireEvent(ui.getByRole('dialog'), new dom.window.Event('cancel', { bubbles: true, cancelable: true }));
  assert.equal(controller.state.editFloor, null);
  dialog = open();
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'À préserver' } });
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(dialog.getByRole('button', { name: 'Enregistrer' }).disabled, true);
  fireEvent.submit(ui.getByRole('dialog').querySelector('form'));
  assert.deepEqual(controller.state.titresEtages, {});
  act(() => controller.setState({ syncRefreshing: false }));
  await act(async () => router.navigate('/echeances'));
  assert.equal(controller.state.editFloor, null);
  assert.deepEqual(controller.state.titresEtages, {});
  await act(async () => router.navigate('/cosmos'));
  assert.equal(ui.queryAllByRole('dialog').length, 0);
  act(() => controller.setState({ needsLogin: true }));
  assert.equal(controller.renameFloor('ethos', 'Refusé'), false);
  act(() => controller.setState({ needsLogin: false }));
  assert.equal(controller.renameFloor('inconnu', 'Refusé'), false);
  assert.equal(controller.renameFloor('ethos', ''), false);
});

test('cosmos espaces : un titre de 300 caractères reste entier après sauvegarde, rechargement et réouverture du champ', async t => {
  let { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  const longTitle = 'É'.repeat(300);
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le titre de PATHOS' }));
  let dialog = within(ui.getByRole('dialog', { name: 'Modifier le titre de l’espace' }));
  assert.equal(dialog.getByRole('textbox').maxLength, 300);
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: longTitle } });
  fireEvent.click(dialog.getByRole('button', { name: 'Enregistrer' }));
  assert.equal(controller.state.titresEtages.pathos, longTitle);
  assert.equal(controller.serialize().titresEtages.pathos, longTitle);
  assert.ok(ui.getByRole('heading', { name: longTitle }));
  assert.deepEqual(controller.state.journal, []);
  ui.unmount(); router.dispose();
  ({ ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false, clearStorage: false }));
  assert.ok(ui.getByRole('heading', { name: longTitle }));
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le titre de ' + longTitle }));
  dialog = within(ui.getByRole('dialog', { name: 'Modifier le titre de l’espace' }));
  assert.equal(dialog.getByRole('textbox').value, longTitle);
  assert.equal(controller.renameFloor('pathos', 'É'.repeat(301)), false);
  assert.equal(controller.state.titresEtages.pathos, longTitle);
  fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
});

test('cosmos groupes : création dans un groupe replié ou vide avec appartenance et espace sauvegardés', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  fireEvent.click(ui.getByRole('button', { name: 'Replier le groupe PROJETS' }));
  const rowsBefore = JSON.stringify(controller.state.rows);
  const open = name => {
    fireEvent.click(ui.getByRole('button', { name: 'Créer un cosmos dans le groupe ' + name }));
    return within(ui.getByRole('dialog', { name: 'Créer un cosmos' }));
  };
  let dialog = open('PROJETS');
  assert.ok(dialog.getByText('Dans le groupe PROJETS'));
  assert.equal(controller.pollState(), null);
  fireEvent.change(dialog.getByRole('textbox', { name: 'Nom du cosmos' }), { target: { value: ' travail ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Créer le cosmos' }));
  assert.match(dialog.getByRole('alert').textContent, /existe déjà/);
  assert.equal(controller.state.cosmos.filter(name => name === 'TRAVAIL').length, 1);
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: ' nouveau projet ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Créer le cosmos' }));
  assert.equal(controller.state.sectionDe['NOUVEAU PROJET'], 'g1');
  assert.equal(controller.state.etageDe['NOUVEAU PROJET'], 'logos');
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  assert.equal(ui.queryByRole('button', { name: 'Replier le cosmos NOUVEAU PROJET' }), null);
  fireEvent.click(ui.getByRole('button', { name: 'Déplier le groupe PROJETS' }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos NOUVEAU PROJET' }));
  fireEvent.change(ui.getByRole('searchbox'), { target: { value: 'GROUPE VIDE' } });
  dialog = open('GROUPE VIDE');
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: ' dans pathos ' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Créer le cosmos' }));
  assert.equal(controller.state.sectionDe['DANS PATHOS'], 'g4');
  assert.equal(controller.state.etageDe['DANS PATHOS'], 'pathos');
  assert.equal(ui.getByRole('searchbox').value, 'GROUPE VIDE');
  assert.ok(within(ui.getByRole('table', { name: 'Tableau PATHOS' })).getByRole('button', { name: 'Déplier le cosmos DANS PATHOS' }));
  assert.equal(JSON.stringify(controller.state.rows), rowsBefore);
  assert.deepEqual(controller.state.journal, []);
  const saved = JSON.parse(localStorage.getItem('cosmos-app-v1'));
  assert.equal(saved.sectionDe['DANS PATHOS'], 'g4');
  assert.equal(saved.etageDe['DANS PATHOS'], 'pathos');
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos DANS PATHOS' }));
});

test('cosmos groupes : édition en ligne et création respectent annulation, lecture seule, suppression distante et navigation', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = savedCosmosData(controller);
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le nom du groupe PROJETS' }));
  const input = ui.getByRole('textbox', { name: 'Nom du groupe' });
  fireEvent.change(input, { target: { value: 'Annulé' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.equal(controller.state.groupAction, null);
  assert.deepEqual(savedCosmosData(controller), before);
  chooseGroupAction(ui, 'PROJETS', 'Modifier');
  act(() => controller.setState({ syncRefreshing: true }));
  const rename = ui.getByRole('textbox', { name: 'Nom du groupe' });
  assert.equal(rename.disabled, true);
  fireEvent.submit(rename.form);
  assert.deepEqual(savedCosmosData(controller), before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(within(ui.getByRole('form', { name: 'Modifier le groupe' })).getByRole('button', { name: 'Annuler' }));
  const create = () => ui.getByRole('button', { name: 'Créer un cosmos dans le groupe PROJETS' });
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(create().disabled, true);
  assert.equal(controller.creerCosmos('Refusé', 'g1'), false);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(create());
  let dialog = within(ui.getByRole('dialog', { name: 'Créer un cosmos' }));
  fireEvent.change(dialog.getByRole('textbox'), { target: { value: 'Brouillon' } });
  fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
  assert.deepEqual(savedCosmosData(controller), before);
  fireEvent.click(create());
  dialog = within(ui.getByRole('dialog', { name: 'Créer un cosmos' }));
  act(() => controller.deleteSection('g1'));
  assert.equal(dialog.getByRole('button', { name: 'Créer le cosmos' }).disabled, true);
  assert.equal(controller.creerCosmos('Refusé', 'g1'), false);
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.groupAction, null);
  assert.equal(controller.state.cosmos.includes('REFUSÉ'), false);
  assert.deepEqual(controller.state.journal, []);
});

test('mini-cosmos : renommage en ligne isolé, validation, annulation et persistance', async t => {
  const { ui, controller, router } = await mount(t);
  act(() => controller.setState({ rows: [...controller.state.rows, { ...row, id: 'other', name: 'Autre mini' }] }));
  const before = JSON.parse(JSON.stringify(controller.state.rows));
  const open = () => fireEvent.click(ui.getByRole('button', { name: 'Modifier le nom du mini-cosmos Projet de test' }));
  open();
  let input = ui.getByRole('textbox', { name: 'Nom du mini-cosmos' });
  assert.equal(document.activeElement, input);
  assert.equal(controller.state.selected, null);
  assert.equal(controller.pollState(), null);
  fireEvent.change(input, { target: { value: ' autre MINI ' } });
  fireEvent.submit(input.form);
  assert.match(ui.getByRole('alert').textContent, /existe déjà/);
  assert.deepEqual(controller.state.rows, before);
  fireEvent.change(input, { target: { value: 'Annulé' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  assert.equal(controller.state.miniNameEditId, null);
  assert.deepEqual(controller.state.rows, before);
  open();
  input = ui.getByRole('textbox', { name: 'Nom du mini-cosmos' });
  fireEvent.change(input, { target: { value: ' Nouveau nom ' } });
  act(() => controller.setState({ syncRefreshing: true }));
  fireEvent.submit(input.form);
  assert.deepEqual(controller.state.rows, before);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.submit(input.form);
  assert.deepEqual(controller.state.rows, [{ ...before[0], name: 'Nouveau nom' }, before[1]]);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(controller.state.selected, null);
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos[0].name, 'Nouveau nom');
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le nom du mini-cosmos Nouveau nom' }));
  fireEvent.change(ui.getByRole('textbox', { name: 'Nom du mini-cosmos' }), { target: { value: 'Non enregistré' } });
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.miniNameEditId, null);
  assert.equal(controller.state.rows[0].name, 'Nouveau nom');
});

test('mini-cosmos : renommage des brouillons et suppression pendant édition', async t => {
  const { ui, controller } = await mount(t);
  act(() => controller.setState({ rows: [{ ...row, draft: true, pause: true, objectif: '', cloture: '' }] }));
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le nom du mini-cosmos Projet de test' }));
  const input = ui.getByRole('textbox', { name: 'Nom du mini-cosmos' });
  fireEvent.change(input, { target: { value: 'Brouillon renommé' } });
  fireEvent.submit(input.form);
  assert.equal(controller.state.rows[0].draft, true);
  assert.equal(controller.state.rows[0].pause, true);
  assert.equal(controller.state.rows[0].name, 'Brouillon renommé');
  fireEvent.click(ui.getByRole('button', { name: 'Modifier le nom du mini-cosmos Brouillon renommé' }));
  act(() => controller.setState({ rows: [] }));
  assert.equal(controller.state.miniNameEditId, null);
  assert.match(controller.renameMini(row.id, 'Disparu'), /existe plus/);
  assert.deepEqual(controller.state.rows, []);
});

test('cosmos : création garde espaces et groupes repliés, même après rechargement', async t => {
  const { ui, controller, router } = await mount(t, '/cosmos', { openCosmos: false });
  const before = localStorage.getItem('cosmos-test-plis-v1');
  act(() => controller.creerCosmos('Nouveau fermé'));
  assert.ok(ui.getByRole('button', { name: floorTitles.LOGOS }));
  assert.equal(ui.queryByRole('button', { name: 'Replier le cosmos NOUVEAU FERMÉ' }), null);
  const open = JSON.parse(localStorage.getItem('cosmos-test-plis-v1')).open;
  assert.deepEqual(open, before ? JSON.parse(before).open : []);
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  fireEvent.click(ui.getByRole('button', { name: floorTitles.LOGOS }));
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos NOUVEAU FERMÉ' }));
});

test('suppression en ligne : boutons cosmos et mini, annulation, garde et nettoyage des dépendances', async t => {
  const { ui, controller, router } = await mount(t);
  act(() => controller.setState({ rows: [...controller.state.rows, { ...row, id: 'dependent', name: 'Dépendant', dependDe: [row.id] }] }));
  const before = JSON.stringify(controller.state.rows);
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  fireEvent.click(ui.getByRole('button', { name: 'Supprimer le cosmos TRAVAIL' }));
  let dialog = within(ui.getByRole('dialog', { name: 'Supprimer le cosmos' }));
  assert.ok(dialog.getByText('TRAVAIL et ses 2 mini-cosmos seront supprimés.'));
  fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  const open = () => fireEvent.click(ui.getByRole('button', { name: 'Supprimer le mini-cosmos Projet de test' }));
  open();
  dialog = within(ui.getByRole('dialog', { name: 'Supprimer le mini-cosmos' }));
  assert.equal(document.activeElement, dialog.getByRole('button', { name: 'Annuler' }));
  assert.equal(controller.pollState(), null);
  assert.equal(controller.state.selected, null);
  fireEvent.click(dialog.getByRole('button', { name: 'Annuler' }));
  assert.equal(JSON.stringify(controller.state.rows), before);
  open();
  dialog = within(ui.getByRole('dialog', { name: 'Supprimer le mini-cosmos' }));
  act(() => controller.setState({ syncRefreshing: true }));
  assert.equal(dialog.getByRole('button', { name: 'Supprimer' }).disabled, true);
  assert.equal(controller.deleteMini(row.id), false);
  act(() => controller.setState({ syncRefreshing: false }));
  fireEvent.click(dialog.getByRole('button', { name: 'Supprimer' }));
  assert.equal(controller.state.rows.length, 1);
  assert.deepEqual(controller.state.rows[0].dependDe, []);
  assert.deepEqual(controller.state.journal, []);
  assert.equal(JSON.parse(localStorage.getItem('cosmos-app-v1')).miniCosmos.length, 1);
  assert.equal(controller.state.miniDeleteId, null);
  fireEvent.click(ui.getByRole('button', { name: 'Supprimer le mini-cosmos Dépendant' }));
  await act(async () => router.navigate('/journal'));
  assert.equal(controller.state.miniDeleteId, null);
  assert.equal(controller.state.rows.length, 1);
});


test('cosmos groupes : les créations successives arrivent en tête sans déplacer les cosmos existants', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = [...controller.state.cosmos];
  const folds = localStorage.getItem('cosmos-test-plis-v1');
  const create = name => {
    fireEvent.click(ui.getByRole('button', { name: 'Créer un cosmos dans le groupe RÉSERVE' }));
    const dialog = within(ui.getByRole('dialog', { name: 'Créer un cosmos' }));
    fireEvent.change(dialog.getByRole('textbox'), { target: { value: name } });
    fireEvent.click(dialog.getByRole('button', { name: 'Créer le cosmos' }));
  };
  create('Premier');
  create('Dernier');
  const expected = [...before];
  expected.splice(expected.indexOf('ATELIER'), 0, 'DERNIER', 'PREMIER');
  assert.deepEqual(controller.state.cosmos, expected);
  assert.equal(localStorage.getItem('cosmos-test-plis-v1'), folds);
  assert.deepEqual(controller.state.journal, []);
  const saved = JSON.parse(localStorage.getItem('cosmos-app-v1'));
  assert.deepEqual(saved.cosmos, expected);
  assert.equal(saved.sectionDe.DERNIER, 'g2');
  assert.equal(saved.etageDe.DERNIER, 'logos');
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  const labels = Array.from(ui.container.querySelectorAll('.ct-cosmos-name .ct-node-name')).map(node => node.textContent);
  assert.deepEqual(labels.filter(name => ['DERNIER', 'PREMIER', 'ATELIER', 'VIDE'].includes(name)), ['DERNIER', 'PREMIER', 'ATELIER', 'VIDE']);
  assert.ok(ui.getByRole('button', { name: 'Déplier le cosmos DERNIER' }));
});


test('groupes : créations successives en tête de leur espace et renommage sans déplacement', async t => {
  const { ui, controller, router } = await mountCosmosDrag(t);
  const before = [...controller.state.sections];
  const create = name => {
    fireEvent.click(ui.getByRole('button', { name: 'Ajouter un groupe dans LOGOS' }));
    const form = ui.getByRole('form', { name: 'Créer un groupe dans LOGOS' });
    fireEvent.change(within(form).getByRole('textbox'), { target: { value: name } });
    fireEvent.submit(form);
  };
  create('Premier groupe');
  create('Dernier groupe');
  const created = controller.state.sections.slice(0, 2);
  assert.deepEqual(created.map(group => group.name), ['Dernier groupe', 'Premier groupe']);
  assert.deepEqual(controller.state.sections.slice(2), before);
  assert.ok(ui.getByRole('button', { name: 'Déplier le groupe Dernier groupe' }));
  act(() => controller.saveSection({ ...created[1], name: 'Premier renommé' }));
  const expected = ['Dernier groupe', 'Premier renommé', 'PROJETS', 'RÉSERVE'];
  const groupNames = () => controller.state.sections.filter(group => group.etage === 'logos').map(group => group.name);
  assert.deepEqual(groupNames(), expected);
  assert.deepEqual(JSON.parse(localStorage.getItem('cosmos-app-v1')).sections, controller.state.sections);
  await act(async () => router.navigate('/journal'));
  await act(async () => router.navigate('/cosmos'));
  const table = ui.getByRole('table', { name: 'Tableau LOGOS' });
  const labels = Array.from(table.querySelectorAll('.ct-section-cell .ct-node-name')).map(node => node.textContent);
  assert.deepEqual(labels, expected);
  assert.deepEqual(controller.state.journal, []);
});
