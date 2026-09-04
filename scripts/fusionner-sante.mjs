// Opération unique (2026-09-04) : fusion du cosmos SANTÉ dans PERSONNEL avec la lentille « santé » sur ses mini-cosmos.
// Usage : node --env-file=.env.local scripts/fusionner-sante.mjs [--sec]
import { createClient } from '@supabase/supabase-js';
const SEC = process.argv.includes('--sec');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
const user = users.users.find(u => (u.email || '').toLowerCase() === (process.env.COSMOS_EMAIL || '').toLowerCase());
if (!user) { console.error('utilisateur introuvable'); process.exit(1); }
const UID = user.id, TAG = 'santé', COLOR = '#818cf8';
const { data: minis } = await sb.from('mini_cosmos').select('id,name,data').eq('user_id', UID).eq('cosmos', 'SANTÉ');
const { data: lentilles } = await sb.from('lentilles').select('name').eq('user_id', UID);
console.log('mini-cosmos SANTÉ :', minis.map(m => m.name).join(', ') || 'aucun', '· lentilles existantes :', lentilles.map(l => l.name).join(', ') || 'aucune');
if (SEC) process.exit(0);
if (!lentilles.some(l => l.name === TAG)) {
  const { error } = await sb.from('lentilles').insert({ user_id: UID, name: TAG, color: COLOR, position: lentilles.length }); if (error) { console.error(error.message); process.exit(1); }
}
const now = new Date().toISOString(), journal = [];
for (const m of minis) {
  const tags = Array.isArray(m.data.tags) ? m.data.tags : [];
  const data = { ...m.data, cosmos: 'PERSONNEL', tags: tags.includes(TAG) ? tags : [...tags, TAG] };
  const { error } = await sb.from('mini_cosmos').update({ data, updated_by: 'Import' }).eq('user_id', UID).eq('id', m.id); if (error) { console.error(m.name, error.message); process.exit(1); }
  journal.push({ id: 'fus-' + m.id, user_id: UID, t: now, author: 'Import', type: 'deplacement', mini_id: m.id, mini: m.name, cosmos: 'PERSONNEL', detail: 'Cosmos parent : SANTÉ → PERSONNEL · lentille « ' + TAG + ' »' });
}
if (minis.length) { const { error } = await sb.from('cosmos').delete().eq('user_id', UID).eq('name', 'SANTÉ'); if (error) { console.error(error.message); process.exit(1); } }
journal.push({ id: 'fus-cosmos-' + Date.now().toString(36), user_id: UID, t: now, author: 'Import', type: 'cosmos', cosmos: 'PERSONNEL', detail: 'Cosmos SANTÉ fusionné dans PERSONNEL (' + minis.length + ' mini-cosmos) · lentille « ' + TAG + ' » créée' });
const { error } = await sb.from('journal').insert(journal); if (error) console.error('journal :', error.message);
console.log('Fait :', minis.length, 'mini-cosmos déplacés dans PERSONNEL avec la lentille « ' + TAG + ' », cosmos SANTÉ retiré.');
