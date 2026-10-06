import test from 'node:test';
import assert from 'node:assert/strict';
import { createControllerClass } from '../app/state/CosmosController.js';
import { readStartupCache, writeStartupCache, clearStartupCache } from '../app/state/startup-cache.ts';
import { createSync } from '../cosmos-sync.js';

const scope = 'https://cosmos-test.invalid';
const session = { user: { id: 'account-a' } };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const state = (name) => ({
  cosmos: ['TRAVAIL'],
  rows: [{ id: 'mc-1', name, cosmos: 'TRAVAIL', actions: [], startAt: '2026-09-01', cloture: '2026-12-31' }],
  etageDe: { TRAVAIL: 'logos' },
  etages: {},
  titresDe: {},
  journal: [],
  propositions: [],
  empty: false,
});
function harness(t, storage = memory()) {
  const gate = deferred(),
    writes = [];
  let authCallback;
  const sync = {
    cacheScope: scope,
    session: async () => session,
    load: () => gate.promise,
    prime() {},
    onError() {},
    onAuth(cb) {
      authCallback = cb;
      return () => {};
    },
    dispose() {},
    listAgents: async () => [],
    assist() {},
    flush: async () => {},
    hasPending: () => false,
    logout: async () => authCallback?.('SIGNED_OUT'),
    save: (s) => writes.push(s),
  };
  const window = { addEventListener() {}, removeEventListener() {} },
    document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const app = new (createControllerClass({
    window,
    document,
    location: { pathname: '/cosmos' },
    localStorage: storage,
    makeSync: async () => sync,
  }))();
  app.flash = () => {};
  t.after(() => app.componentWillUnmount());
  return { app, sync, gate, writes, storage };
}

test('le cache est isolé par compte et projet, expire et exclut tout le Journal', (t) => {
  const storage = memory();
  t.mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  writeStartupCache(storage, scope, 'account-a', {
    ...state('Copie'),
    journal: [{ id: 'supprimé' }],
    journalArchive: [{ id: 'archive' }],
    access_token: 'secret',
  });
  assert.equal(readStartupCache(storage, scope, 'account-a').rows[0].name, 'Copie');
  assert.equal(readStartupCache(storage, scope, 'account-b'), null);
  assert.equal(readStartupCache(storage, 'other-project', 'account-a'), null);
  assert.doesNotMatch([...storage.values.values()].join(''), /supprimé|archive|secret|journal/i);
  t.mock.timers.tick(24 * 60 * 60 * 1000 + 1);
  assert.equal(readStartupCache(storage, scope, 'account-a'), null);
  clearStartupCache(storage, scope, 'account-a');
  assert.equal(storage.values.size, 0);
});

test('un cache corrompu ou un stockage indisponible ne bloque pas le démarrage', () => {
  const storage = memory();
  writeStartupCache(storage, scope, 'a', state('Copie'));
  const key = [...storage.values.keys()][0];
  storage.values.set(key, '{invalid');
  assert.equal(readStartupCache(storage, scope, 'a'), null);
  const blocked = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
    removeItem() {
      throw Error();
    },
  };
  assert.equal(readStartupCache(blocked, scope, 'a'), null);
  assert.doesNotThrow(() => writeStartupCache(blocked, scope, 'a', state('Copie')));
  assert.doesNotThrow(() => clearStartupCache(blocked, scope, 'a'));
});

test('le démarrage montre le cache après identification sans jamais le sauvegarder ni restaurer le Journal', async (t) => {
  const h = harness(t);
  writeStartupCache(h.storage, scope, session.user.id, {
    ...state('Ancienne copie'),
    journal: [{ id: 'supprimé' }],
  });
  h.app.componentDidMount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.app.state.ready, true);
  assert.equal(h.app.state.syncRefreshing, true);
  assert.equal(h.app.state.rows[0].name, 'Ancienne copie');
  assert.deepEqual(h.app.state.journal, []);
  h.app.componentDidUpdate();
  h.app.persist();
  assert.equal(h.writes.length, 0);
  assert.equal(h.app.pollState(), null);
  h.gate.resolve({ ...state('Version serveur'), titresDe: { TRAVAIL: ['Nouveau titre'] } });
  await h.app.bootTask;
  assert.equal(h.app.state.syncRefreshing, false);
  assert.equal(h.app.state.rows[0].name, 'Version serveur');
  assert.deepEqual(h.app.state.titresDe, { TRAVAIL: ['Nouveau titre'] });
  assert.deepEqual(h.app.state.journal, []);
  assert.equal(readStartupCache(h.storage, scope, session.user.id).rows[0].name, 'Version serveur');
});

test('un échec réseau garde la copie en lecture seule puis une nouvelle lecture la remplace', async (t) => {
  t.mock.method(console, 'error', () => {});
  const h = harness(t);
  writeStartupCache(h.storage, scope, session.user.id, state('Ancienne copie'));
  h.app.componentDidMount();
  await new Promise((resolve) => setImmediate(resolve));
  h.gate.reject(new Error('Réseau indisponible'));
  await h.app.bootTask;
  assert.equal(h.app.state.syncRefreshing, true);
  assert.match(h.app.state.bootError, /Réseau/);
  h.app.componentDidUpdate();
  assert.equal(h.writes.length, 0);
  h.sync.load = async () => state('Actualisée');
  await h.app.bootDb();
  assert.equal(h.app.state.syncRefreshing, false);
  assert.equal(h.app.state.bootError, '');
  assert.equal(h.app.state.rows[0].name, 'Actualisée');
});

test('une réponse arrivée après déconnexion ne réaffiche pas les données du compte', async (t) => {
  const h = harness(t);
  writeStartupCache(h.storage, scope, session.user.id, state('Copie'));
  h.app.componentDidMount();
  await new Promise((resolve) => setImmediate(resolve));
  await h.app.logout();
  h.gate.resolve(state('Réponse tardive'));
  await h.app.bootTask;
  assert.equal(h.app.state.ready, false);
  assert.equal(h.app.state.needsLogin, true);
  assert.deepEqual(h.app.state.rows, []);
  assert.equal(readStartupCache(h.storage, scope, session.user.id), null);
  assert.equal(h.writes.length, 0);
});

test('un montage abandonné ne lance ni lecture Supabase ni abonnement après démontage', async (t) => {
  const h = harness(t);
  let reads = 0;
  h.sync.session = async () => {
    reads++;
    return session;
  };
  h.app.componentDidMount();
  h.app.componentWillUnmount();
  await h.app.bootTask;
  assert.equal(reads, 0);
  assert.equal(h.app.state.ready, false);
});

test('la configuration compilée évite le téléchargement préalable de /api/config', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Aucune requête de configuration attendue');
  });
  const sync = await createSync({
    config: { supabaseUrl: scope, supabaseKey: 'public-test' },
    clientFactory: (url, key) => {
      assert.equal(url, scope);
      assert.equal(key, 'public-test');
      return {};
    },
  });
  assert.ok(sync);
  assert.equal(await createSync({ config: {} }), null);
});

test('une ancienne lecture ne remplace pas la référence serveur d’un chargement plus récent', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const first = deferred(),
    writes = [];
  const payload = (name) => ({
    ...state(name),
    miniCosmos: state(name).rows.map((data) => ({ id: data.id, data, position: 0 })),
    now: new Date().toISOString(),
  });
  let reads = 0;
  const db = {
    async rpc(name, args) {
      if (name === 'charger_etat_v4') {
        reads++;
        return reads === 1 ? first.promise : { data: payload('Récente') };
      }
      writes.push(args);
      return { data: {} };
    },
  };
  const sync = await createSync({
    config: { supabaseUrl: scope, supabaseKey: 'test' },
    clientFactory: () => db,
  });
  const old = sync.load();
  const recent = await sync.load();
  first.resolve({ data: payload('Ancienne') });
  await assert.rejects(old, /plus récent/);
  sync.save(recent);
  await sync.flush();
  assert.equal(writes.length, 0);
  sync.dispose();
});

test('déconnexion pendant une sauvegarde : pas de retry ni de file réutilisée pour le compte suivant', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gate = deferred();
  let authCallback,
    writes = 0,
    unsubscribed = false;
  const db = {
    auth: {
      onAuthStateChange(cb) {
        authCallback = cb;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribed = true;
              },
            },
          },
        };
      },
    },
    async rpc(name) {
      if (name === 'charger_etat_v4')
        return {
          data: {
            ...state('Initial'),
            miniCosmos: state('Initial').rows.map((data) => ({ id: data.id, data, position: 0 })),
            now: new Date().toISOString(),
          },
        };
      writes++;
      return gate.promise;
    },
  };
  const sync = await createSync({
    config: { supabaseUrl: scope, supabaseKey: 'test' },
    clientFactory: () => db,
  });
  const unsubscribe = sync.onAuth(() => {});
  const data = await sync.load();
  sync.save({ ...data, rows: data.rows.map((row) => ({ ...row, name: 'Changé' })) });
  const flush = sync.flush();
  authCallback('SIGNED_OUT', null);
  gate.resolve({ error: { message: 'Échec après déconnexion' } });
  await flush;
  t.mock.timers.tick(60000);
  assert.equal(writes, 1);
  assert.equal(sync.hasPending(), false);
  unsubscribe();
  assert.equal(unsubscribed, true);
  sync.dispose();
});

test('les titres personnalisés restent visibles depuis le cache et sont remplacés par la version serveur', async t => {
  const storage = memory();
  writeStartupCache(storage, scope, session.user.id, { ...state('Copie'), titresEtages: { logos: 'ATELIER LOCAL' } });
  const h = harness(t, storage);
  h.app.componentDidMount();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(h.app.state.titresEtages, { logos: 'ATELIER LOCAL' });
  h.gate.resolve({ ...state('Serveur'), titresEtages: { logos: 'ATELIER SERVEUR' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(h.app.state.titresEtages, { logos: 'ATELIER SERVEUR' });
  assert.deepEqual(readStartupCache(storage, scope, session.user.id).titresEtages, { logos: 'ATELIER SERVEUR' });
  h.app.clearSession();
  assert.deepEqual(h.app.state.titresEtages, {});
});
