// cosmos-sync.js — synchronisation avec Supabase (facultative).
// Sans /api/config (fichier ouvert en local) ou sans variables Supabase côté serveur, l'app reste en localStorage.
// Ce module ignore l'interface : il charge l'état, sauvegarde en différentiel (une transaction par lot),
// et remonte ce qui a changé ailleurs — agents IA, autre appareil — sans jamais écraser une saisie en cours.
import { migrate } from './cosmos-core.js';

export async function createSync({ author = 'Toi' } = {}) {
  let cfg = {};
  try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch (e) { /* pas de serveur : mode local */ }
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return null;
  if (!window.supabase) throw new Error('supabase-js non chargé');
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  // Ce que le serveur connaît, pour calculer les différences
  const cache = { rows: new Map(), cosmosJson: '', journalIds: new Set(), lastPoll: null };
  let queue = null, timer = null, retryTimer = null, inflight = null, retries = 0, revision = 0, onError = () => {}, currentEmail = '';
  const structureKeys = ['cosmos', 'etageDe', 'etages', 'titresDe'];
  const structureValue = (s, key) => s[key] || (key === 'cosmos' ? [] : {});

  // Postgres réordonne les clés JSON : comparer leur contenu, tout en conservant l'ordre des tableaux.
  const rowKey = x => JSON.stringify(x, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
  const iso = t => { const d = new Date(t); return isNaN(d) ? String(t) : d.toISOString(); };
  const jEntry = j => { const e = { id: j.id, t: iso(j.t), author: j.author, type: j.type, mini: j.mini || undefined, miniId: j.miniId ?? j.mini_id ?? undefined, cosmos: j.cosmos || undefined, detail: j.detail || '' }; if (j.changes) e.changes = j.changes; return e; };
  const pEntry = p => ({ id: p.id, agent: p.agent ?? p.agent_name, miniId: p.miniId ?? p.mini_id, patch: p.patch || {}, motif: p.motif || '', createdAt: p.createdAt ?? p.created_at });
  const fr = e => { const m = String((e && e.message) || e); if (/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect'; if (/email not confirmed/i.test(m)) return 'Email non confirmé'; if (/rate limit/i.test(m)) return 'Trop de tentatives, réessaie dans un instant'; if (/failed to fetch|networkerror/i.test(m)) return 'Réseau indisponible'; return m; };

  // ---- session -------------------------------------------------------------
  async function session() { const { data } = await db.auth.getSession(); currentEmail = data.session?.user?.email || ''; return data.session; }
  async function login(email, password) { const { data, error } = await db.auth.signInWithPassword({ email, password }); if (error) throw new Error(fr(error)); currentEmail = data.user?.email || ''; return data.session; }
  async function logout() { await db.auth.signOut(); currentEmail = ''; }
  function onAuth(cb) { db.auth.onAuthStateChange((event, s) => { currentEmail = s?.user?.email || currentEmail; cb(event, s); }); }
  const email = () => currentEmail;

  // ---- chargement ----------------------------------------------------------
  async function readState() {
    const { data, error } = await db.rpc('charger_etat');
    if (error) throw new Error(fr(error));
    if (!data || !Array.isArray(data.cosmos) || !Array.isArray(data.miniCosmos) || !Array.isArray(data.journal) || !Array.isArray(data.propositions)) throw new Error('État reçu de la base incomplet');
    return data;
  }
  function stateFrom(data) {
    const rows = (data.miniCosmos || []).map(r => r.data);
    return { cosmos: data.cosmos || [], etageDe: data.etageDe || {}, etages: data.etages || {}, titresDe: data.titresDe || {}, rows, journal: (data.journal || []).map(jEntry), journalArchived: data.journalArchived || 0,
      propositions: (data.propositions || []).map(pEntry), empty: !(data.cosmos || []).length && !rows.length };
  }
  function remember(data, state) {
    cache.rows = new Map((data.miniCosmos || []).map((r, i) => [r.id, { json: rowKey(r.data), position: i, savedAt: r.updated_at }]));
    cache.journalIds = new Set();
    prime(state);
    cache.lastPoll = data.now;
  }
  async function load() {
    revision++;
    const data = await readState(), state = stateFrom(data);
    remember(data, state);
    return state;
  }
  // Après migration côté app : considère l'état courant comme sauvegardé (les migrations sont rejouées à chaque chargement)
  function prime(state) {
    cache.rows = new Map(state.rows.map((x, i) => { const p = cache.rows.get(x.id); return [x.id, { json: rowKey(x), position: i, savedAt: p ? p.savedAt : null }]; }));
    cache.cosmosJson = rowKey(state.cosmos);
    cache.etageDeJson = rowKey(state.etageDe || {});
    cache.etagesJson = rowKey(state.etages || {});
    cache.titresDeJson = rowKey(state.titresDe || {});
    (state.journal || []).forEach(e => cache.journalIds.add(e.id));
  }

  // ---- sauvegarde différentielle (regroupée, une transaction par lot) ---------
  function save(state) {
    revision++;
    clearTimeout(retryTimer); retries = 0;
    queue = { ...state, replace: !!state.replace || !!(queue && queue.replace) };
    clearTimeout(timer); timer = setTimeout(flush, 350);
  }
  function flush() {
    clearTimeout(timer); clearTimeout(retryTimer);
    if (inflight) return inflight;
    inflight = (async () => {
      while (queue) {
        const s = queue; queue = null;
        try { await doSave(s); retries = 0; }
        catch (e) {
          onError(new Error(fr(e)));
          if (!queue) queue = s; else queue.replace = queue.replace || s.replace;
          if (retries < 3) { retries++; retryTimer = setTimeout(flush, [5000, 15000, 45000][retries - 1]); }
          break;
        }
      }
    })().finally(() => { inflight = null; });
    return inflight;
  }
  async function doSave(s) {
    const rowsPayload = [], seen = new Set();
    s.rows.forEach((x, i) => { seen.add(x.id); const j = rowKey(x), p = cache.rows.get(x.id); if (!p || p.json !== j || p.position !== i) rowsPayload.push({ id: x.id, data: x, position: i }); });
    const deleted = [...cache.rows.keys()].filter(id => !seen.has(id));
    const cosmosJson = rowKey(s.cosmos);
    const cosmosPayload = cosmosJson !== cache.cosmosJson ? s.cosmos : null;
    const journalPayload = (s.journal || []).filter(e => !cache.journalIds.has(e.id));
    const etageDeJson = rowKey(s.etageDe || {}), etagesJson = rowKey(s.etages || {});
    const etageDePayload = etageDeJson !== cache.etageDeJson ? (s.etageDe || {}) : null;   // carte complète { cosmos : étage }
    const etagesPayload = etagesJson !== cache.etagesJson ? (s.etages || {}) : null;       // carte complète { étage : repère }
    const titresDeJson = rowKey(s.titresDe || {});
    const titresDePayload = titresDeJson !== cache.titresDeJson ? (s.titresDe || {}) : null;   // carte complète { cosmos : [titres] }
    const replace = !!s.replace;
    if (!replace && !rowsPayload.length && !deleted.length && !cosmosPayload && !journalPayload.length && !etageDePayload && !etagesPayload && !titresDePayload) return;
    const args = replace
      ? { p_cosmos: s.cosmos, p_rows: s.rows.map((x, i) => ({ id: x.id, data: x, position: i })), p_deleted: [], p_journal: s.journal || [], p_replace: true, p_author: author, p_etage_de: s.etageDe || {}, p_etages: s.etages || {}, p_titres_de: s.titresDe || {} }
      : { p_cosmos: cosmosPayload, p_rows: rowsPayload, p_deleted: deleted, p_journal: journalPayload, p_replace: false, p_author: author, p_etage_de: etageDePayload, p_etages: etagesPayload, p_titres_de: titresDePayload };
    const { data, error } = await db.rpc('sync_etat', args);
    if (error) throw error;
    const at = data && data.savedAt;
    if (replace) { cache.rows = new Map(); cache.journalIds = new Set(); }
    (replace ? args.p_rows : rowsPayload).forEach(r => cache.rows.set(r.id, { json: rowKey(r.data), position: r.position, savedAt: at }));
    deleted.forEach(id => cache.rows.delete(id));
    cache.cosmosJson = cosmosJson;
    cache.etageDeJson = etageDeJson;
    cache.etagesJson = etagesJson;
    cache.titresDeJson = titresDeJson;
    (replace ? (s.journal || []) : journalPayload).forEach(e => cache.journalIds.add(e.id));
    if (at && (!cache.lastPoll || at > cache.lastPoll)) cache.lastPoll = at;
  }

  // ---- ce qui a changé ailleurs (agents, autre appareil) -------------------
  function hasLocalChanges(state) {
    return state.rows.length !== cache.rows.size
      || state.rows.some((x, i) => { const p = cache.rows.get(x.id); return !p || p.json !== rowKey(x) || p.position !== i; })
      || structureKeys.some(key => rowKey(structureValue(state, key)) !== cache[key + 'Json'])
      || (state.journal || []).some(j => !cache.journalIds.has(j.id));
  }
  // Un instantané complet détecte aussi les suppressions, les déplacements et les changements sans horodatage.
  // getState renvoie null pendant une édition ; applyState est appelé sans attente après la mise à jour du cache.
  async function poll(getState, applyState) {
    const before = getState();
    if (!before || !cache.lastPoll || queue || inflight || hasLocalChanges(before)) return null;
    const version = revision;
    const data = await readState();
    const current = getState();
    // Une saisie ou une sauvegarde commencée pendant la requête invalide cet instantané.
    if (!current || version !== revision || queue || inflight || hasLocalChanges(current)) return null;
    const next = stateFrom(data);
    next.rows = migrate(next.rows);
    const local = new Map(current.rows.map(x => [x.id, x]));
    const changedRows = next.rows.filter(x => !local.has(x.id) || rowKey(x) !== rowKey(local.get(x.id)));
    const ids = new Set(next.rows.map(x => x.id));
    const deleted = current.rows.filter(x => !ids.has(x.id)).map(x => x.id);
    // Garder les références inchangées évite de relancer la persistance à chaque relève.
    for (const key of [...structureKeys, 'rows', 'journal', 'propositions']) {
      if (rowKey(next[key]) === rowKey(current[key])) next[key] = current[key];
    }
    remember(data, next);
    const changes = { deleted, rows: changedRows.map(x => ({ data: x, updatedBy: data.miniCosmos.find(r => r.id === x.id)?.updated_by })) };
    applyState(next, changes);
    return changes;
  }

  // ---- propositions, agents, assistant, archive ----------------------------
  async function decideProposition(id, statut) { const { error } = await db.from('propositions').update({ statut, decided_at: new Date().toISOString() }).eq('id', id); if (error) throw new Error(fr(error)); }
  async function listAgents() { const { data, error } = await db.from('agents').select('id,name,ecriture_directe,actif,created_at,last_used_at').order('created_at'); if (error) throw new Error(fr(error)); return data; }
  async function createAgent(name, direct) { const { data, error } = await db.rpc('creer_agent', { p_name: name, p_ecriture_directe: !!direct }); if (error) throw new Error(fr(error)); return data; }
  async function revokeAgent(id) { const { error } = await db.from('agents').update({ actif: false }).eq('id', id); if (error) throw new Error(fr(error)); }
  async function assist(req) {
    const { data } = await db.auth.getSession();
    if (!data.session) throw new Error('Connexion requise');
    const r = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify(req) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || ('HTTP ' + r.status));
    return body.text;
  }
  async function journalArchive() {
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - 1);
    const { data, error } = await db.from('journal').select('id,t,author,type,mini_id,mini,cosmos,detail,changes').lt('t', cut.toISOString()).order('t', { ascending: false });
    if (error) throw new Error(fr(error));
    return data.map(jEntry);
  }

  return { session, login, logout, onAuth, email, load, prime, save, flush, poll, decideProposition, listAgents, createAgent, revokeAgent, assist, journalArchive, onError: cb => { onError = cb; } };
}
