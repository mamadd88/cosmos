// Ajoute à la base les mini-cosmos d'un ancien export Cosmos, sans toucher aux lignes existantes.
// Usage : node --env-file=.env.local scripts/importer-ancien-export.mjs <fichier.json> [--pause] [--sans-sas] [--sec]
//   --pause    : tous les mini-cosmos importés sont mis en Pause
//   --sans-sas : le champ SAS est vidé (ancien système de SAS)
//   --sec      : affiche la conversion sans rien écrire
// Les identifiants importés sont préfixés mc-old- (mini-cosmos) et old- (journal) : pour tout retirer,
//   delete from mini_cosmos where id like 'mc-old-%' ; delete from journal where id like 'old-%'
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2); const file = args.find(a => !a.startsWith('--'));
const PAUSE = args.includes('--pause'), SANS_SAS = args.includes('--sans-sas'), SEC = args.includes('--sec');
if (!file) { console.error('Usage : node --env-file=.env.local scripts/importer-ancien-export.mjs <fichier.json> [--pause] [--sans-sas] [--sec]'); process.exit(1); }
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, email = process.env.COSMOS_EMAIL;
if (!url || !key || !email) { console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et COSMOS_EMAIL requis (dans .env.local)'); process.exit(1); }

const old = JSON.parse(readFileSync(file, 'utf8'));
const rows = old.miniCosmos || [];
if (!rows.length) { console.error('aucun mini-cosmos dans ce fichier'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
if (!user) { console.error('utilisateur introuvable :', email); process.exit(1); }
const UID = user.id, TODAY = new Date().toISOString().slice(0, 10);

// --- conversion ---------------------------------------------------------------------------------
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const v = x => (x == null || String(x).trim() === '') ? '—' : String(x).trim();
const cloture = c => {
  if (!c || c === 'Permanent') return 'Permanent';
  if (/^\d{4}-\d{2}-\d{2}$/.test(c) || /^(M:\d{4}-\d{2}|Q:\d{4}-Q[1-4]|Y:\d{4})$/.test(c)) return c;
  const m = c.match(/^Fin (\S+) (\d{4})/); if (m && MOIS.includes(m[1])) return 'M:' + m[2] + '-' + String(MOIS.indexOf(m[1]) + 1).padStart(2, '0');
  const y = c.match(/^Fin (\d{4})/); if (y) return 'Y:' + y[1];
  console.warn('  clôture non reconnue « ' + c + ' » → Permanent'); return 'Permanent';
};
const junk = t => !t || !t.trim() || /^(.)\1+$/.test(t.trim());
const idOf = r => 'mc-old-' + String(r.id || '').replace(/^mc-/, '').replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase();

const minis = rows.map(r => {
  const createdAt = /^\d{4}-\d{2}-\d{2}/.test(r.createdAt || '') ? r.createdAt.slice(0, 10) : TODAY;
  const actions = (r.actions || []).filter(a => !junk(a.text)).map(a => ({ text: a.text.trim(), done: !!a.done }));
  const history = [...(r.history || []).filter(h => h && h.t && h.type), ...(PAUSE ? [{ t: TODAY, type: 'statut', value: 'Pause' }] : [])];
  const sas = SANS_SAS ? '—' : v(r.sas);
  return { id: idOf(r), cosmos: v(r.cosmos).toUpperCase(), name: v(r.name), objectif: v(r.objectif), actuel: v(r.actuel), sas, entropie: v(r.entropie), reponse: v(r.reponse),
    alerte: v(r.alerte), kill: v(r.kill), pause: PAUSE ? true : !!r.pause, closed: !!r.closed, sasDone: false, startAt: createdAt, cloture: cloture(r.cloture),
    alertDays: Number.isFinite(+r.tensionDays) ? +r.tensionDays : (Number.isFinite(+r.alertDays) ? +r.alertDays : 7), actions, createdAt, history };
});

// --- état actuel --------------------------------------------------------------------------------
const { data: curCos } = await sb.from('cosmos').select('name,position').eq('user_id', UID).order('position');
const { data: curMinis } = await sb.from('mini_cosmos').select('id,cosmos,name,position').eq('user_id', UID);
const already = curMinis.filter(m => minis.some(x => x.id === m.id));
if (already.length) { console.error('déjà importé : ' + already.map(m => m.name).join(', ') + ' — rien à faire'); process.exit(1); }
const taken = new Set(curMinis.map(m => m.cosmos + '|' + m.name.toLowerCase()));
minis.forEach(m => { if (taken.has(m.cosmos + '|' + m.name.toLowerCase())) m.name += ' (ancien)'; });
const newCosmos = [...new Set(minis.map(m => m.cosmos))].filter(c => !curCos.some(x => x.name === c));
let pos = Math.max(-1, ...curMinis.map(m => m.position)) + 1;
const miniRows = minis.map(m => ({ id: m.id, user_id: UID, data: m, position: pos++, updated_by: 'Import' }));
const journalRows = (old.journal || []).filter(e => e && e.t && e.type).map((e, i) => ({
  id: 'old-' + (e.id || i), user_id: UID, t: e.t, author: e.author || 'Import', type: e.type, mini_id: null, mini: e.mini || null, cosmos: e.cosmos || null, detail: e.detail || '', changes: e.changes || null }));
const resume = Object.entries(minis.reduce((a, m) => (a[m.cosmos] = (a[m.cosmos] || 0) + 1, a), {})).map(([c, n]) => c + ' ' + n).join(', ');
journalRows.push({ id: 'old-import-' + Date.now().toString(36), user_id: UID, t: new Date().toISOString(), author: 'Import', type: 'donnees', mini_id: null, mini: null, cosmos: null,
  detail: 'Import de ' + file + ' — ' + minis.length + ' mini-cosmos ajoutés (' + resume + ')' + (PAUSE ? ' en Pause' : '') + (SANS_SAS ? ', sans SAS' : '') + ' · ' + (journalRows.length) + ' entrées de journal reprises', changes: null });

console.log('Conversion :'); console.table(minis.map(m => ({ cosmos: m.cosmos, name: m.name, cloture: m.cloture, preavis: m.alertDays, etapes: m.actions.length, pause: m.pause, sas: m.sas, id: m.id })));
console.log('Nouveaux cosmos :', newCosmos.join(', ') || 'aucun', '· journal :', journalRows.length, 'entrées');
if (SEC) { console.log('(--sec : rien écrit)'); process.exit(0); }

// --- écriture -----------------------------------------------------------------------------------
if (newCosmos.length) {
  let cpos = Math.max(-1, ...curCos.map(c => c.position)) + 1;
  const { error } = await sb.from('cosmos').insert(newCosmos.map(name => ({ user_id: UID, name, position: cpos++ })));
  if (error) { console.error('cosmos :', error.message); process.exit(1); }
}
{ const { error } = await sb.from('mini_cosmos').insert(miniRows); if (error) { console.error('mini_cosmos :', error.message); process.exit(1); } }
{ const { error } = await sb.from('journal').insert(journalRows); if (error) { console.error('journal :', error.message, '(les mini-cosmos sont importés)'); process.exit(1); } }
console.log('Importé :', minis.length, 'mini-cosmos,', newCosmos.length, 'cosmos,', journalRows.length, 'entrées de journal. Recharge l’app pour voir les nouveaux cosmos.');
