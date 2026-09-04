// Opération unique (2026-09-04) : les mini-cosmos « Permanent » deviennent des mandats d'un an (cloture 'A:AAAA-MM-JJ'),
// calés sur leur date de début ou de création et reportés d'année en année jusqu'à la prochaine échéance après aujourd'hui.
// Usage : node --env-file=.env.local scripts/migrer-mandats.mjs [--sec]
import { createClient } from '@supabase/supabase-js';
import * as core from '../cosmos-core.js';
const SEC = process.argv.includes('--sec');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find(u => (u.email || '').toLowerCase() === (process.env.COSMOS_EMAIL || '').toLowerCase());
if (!user) { console.error('utilisateur introuvable'); process.exit(1); }
const { data: minis } = await sb.from('mini_cosmos').select('id,name,cosmos,data').eq('user_id', user.id);
const todo = minis.filter(m => !m.data.closed && (!m.data.cloture || m.data.cloture === 'Permanent' || m.data.cloture === 'À dater'));
const plan = todo.map(m => ({ m, cloture: core.mandatDepuis(core.startOf(m.data) || m.data.createdAt) }));
console.table(plan.map(p => ({ cosmos: p.m.cosmos, name: p.m.name, avant: p.m.data.cloture || '(vide)', mandat: core.clotureLabel(p.cloture) })));
if (SEC) { console.log('(--sec : rien écrit)'); process.exit(0); }
const now = new Date().toISOString(), journal = [];
for (const p of plan) {
  const { error } = await sb.from('mini_cosmos').update({ data: { ...p.m.data, cloture: p.cloture }, updated_by: 'Import' }).eq('user_id', user.id).eq('id', p.m.id);
  if (error) { console.error(p.m.name, error.message); process.exit(1); }
  journal.push({ id: 'mandat-' + p.m.id, user_id: user.id, t: now, author: 'Import', type: 'modification', mini_id: p.m.id, mini: p.m.name, cosmos: p.m.cosmos,
    detail: 'Permanent → ' + core.clotureLabel(p.cloture).toLowerCase() + ' (à renouveler au terme, ou à supprimer)', changes: [{ field: 'Clôture', before: 'Permanent', after: core.clotureLabel(p.cloture) }] });
}
if (journal.length) { const { error } = await sb.from('journal').insert(journal); if (error) console.error('journal :', error.message); }
console.log('Fait :', plan.length, 'mini-cosmos passés en mandat d’un an.');
