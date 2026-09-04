// cosmos-sync.js — synchronisation avec Supabase (facultative).
// Sans /api/config (fichier ouvert en local) ou sans variables Supabase côté serveur, l'app reste en localStorage.
// Ce module ignore l'interface : il charge l'état, sauvegarde en différentiel (une transaction par lot),
// et remonte ce qui a changé ailleurs — agents IA, autre appareil — sans jamais écraser une saisie en cours.

export async function createSync({ author = 'Toi' } = {}) {
  let cfg = {};
  try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch (e) { /* pas de serveur : mode local */ }
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return null;
  if (!window.supabase) throw new Error('supabase-js non chargé');
  const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  // Ce que le serveur connaît, pour calculer les différences
  const cache = { rows: new Map(), cosmosJson: '', lentillesJson: '[]', journalIds: new Set(), lastPoll: null };
  let queue = null, timer = null, inflight = null, retries = 0, onError = () => {}, currentEmail = '';

  const rowKey = x => JSON.stringify(x);
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
  async function load() {
    const { data, error } = await db.rpc('charger_etat');
    if (error) throw new Error(fr(error));
    const minis = data.miniCosmos || [];
    cache.rows = new Map(minis.map((r, i) => [r.id, { json: rowKey(r.data), position: i, savedAt: r.updated_at }]));
    cache.cosmosJson = JSON.stringify(data.cosmos || []);
    cache.lentillesJson = JSON.stringify(data.lentilles || []);
    cache.journalIds = new Set((data.journal || []).map(j => j.id));
    cache.lastPoll = data.now;
    const rows = minis.map(r => r.data);
    return { cosmos: data.cosmos || [], lentilles: data.lentilles || [], rows, journal: (data.journal || []).map(jEntry), journalArchived: data.journalArchived || 0,
      propositions: (data.propositions || []).map(pEntry), empty: !(data.cosmos || []).length && !rows.length };
  }
  // Après migration côté app : considère l'état courant comme sauvegardé (les migrations sont rejouées à chaque chargement)
  function prime(state) {
    state.rows.forEach((x, i) => { const p = cache.rows.get(x.id); cache.rows.set(x.id, { json: rowKey(x), position: i, savedAt: p ? p.savedAt : null }); });
    cache.cosmosJson = JSON.stringify(state.cosmos);
    cache.lentillesJson = JSON.stringify(state.lentilles || []);
    (state.journal || []).forEach(e => cache.journalIds.add(e.id));
  }

  // ---- sauvegarde différentielle (regroupée, une transaction par lot) ---------
  function save(state) {
    queue = { ...state, replace: !!state.replace || !!(queue && queue.replace) };
    clearTimeout(timer); timer = setTimeout(flush, 350);
  }
  function flush() {
    if (inflight) return inflight;
    inflight = (async () => {
      while (queue) {
        const s = queue; queue = null;
        try { await doSave(s); retries = 0; }
        catch (e) {
          onError(new Error(fr(e)));
          if (retries < 3) { retries++; const wait = [5000, 15000, 45000][retries - 1]; setTimeout(() => { if (!queue) queue = s; else queue.replace = queue.replace || s.replace; flush(); }, wait); }
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
    const cosmosJson = JSON.stringify(s.cosmos);
    const cosmosPayload = cosmosJson !== cache.cosmosJson ? s.cosmos : null;
    const journalPayload = (s.journal || []).filter(e => !cache.journalIds.has(e.id));
    const lentillesJson = JSON.stringify(s.lentilles || []);
    const lentillesPayload = lentillesJson !== cache.lentillesJson ? (s.lentilles || []) : null;
    const replace = !!s.replace;
    if (!replace && !rowsPayload.length && !deleted.length && !cosmosPayload && !journalPayload.length && !lentillesPayload) return;
    const args = replace
      ? { p_cosmos: s.cosmos, p_rows: s.rows.map((x, i) => ({ id: x.id, data: x, position: i })), p_deleted: [], p_journal: s.journal || [], p_replace: true, p_author: author, p_lentilles: s.lentilles || [] }
      : { p_cosmos: cosmosPayload, p_rows: rowsPayload, p_deleted: deleted, p_journal: journalPayload, p_replace: false, p_author: author, p_lentilles: lentillesPayload };
    const { data, error } = await db.rpc('sync_etat', args);
    if (error) throw error;
    const at = data && data.savedAt;
    if (replace) { cache.rows = new Map(); cache.journalIds = new Set(); }
    (replace ? args.p_rows : rowsPayload).forEach(r => cache.rows.set(r.id, { json: rowKey(r.data), position: r.position, savedAt: at }));
    deleted.forEach(id => cache.rows.delete(id));
    cache.cosmosJson = cosmosJson;
    cache.lentillesJson = lentillesJson;
    (replace ? (s.journal || []) : journalPayload).forEach(e => cache.journalIds.add(e.id));
    if (at && (!cache.lastPoll || at > cache.lastPoll)) cache.lastPoll = at;
  }

  // ---- ce qui a changé ailleurs (agents, autre appareil) -------------------
  async function poll(currentRows) {
    if (!cache.lastPoll) return null;
    const since = cache.lastPoll;
    const [r1, r2, r3] = await Promise.all([
      db.from('mini_cosmos').select('id,data,position,updated_at,updated_by').gt('updated_at', since),
      db.from('journal').select('id,t,author,type,mini_id,mini,cosmos,detail,changes,created_at').gt('created_at', since),
      db.from('propositions').select('id,agent_name,mini_id,patch,motif,created_at').eq('statut', 'en_attente').order('created_at'),
    ]);
    for (const r of [r1, r2, r3]) if (r.error) throw new Error(fr(r.error));
    let last = since;
    const local = new Map((currentRows || []).map(x => [x.id, x]));
    const rows = [];
    for (const r of r1.data) {
      if (r.updated_at > last) last = r.updated_at;
      const p = cache.rows.get(r.id);
      if (p && !(r.updated_at > (p.savedAt || ''))) continue;                  // notre propre écriture
      const mine = local.get(r.id);
      if (mine && p && rowKey(mine) !== p.json) continue;                      // modifié ici, pas encore sauvegardé : le local gagne
      cache.rows.set(r.id, { json: rowKey(r.data), position: p ? p.position : cache.rows.size, savedAt: r.updated_at });
      rows.push({ data: r.data, updatedBy: r.updated_by });
    }
    const journal = [];
    for (const j of r2.data) { if (j.created_at > last) last = j.created_at; if (cache.journalIds.has(j.id)) continue; cache.journalIds.add(j.id); journal.push(jEntry(j)); }
    cache.lastPoll = last;
    return { rows, journal, propositions: r3.data.map(pEntry) };
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
