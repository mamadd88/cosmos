// Aperçu rapide de la base : compteurs et dernières lignes. Usage : node --env-file=.env.local scripts/etat-base.mjs
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (dans .env.local)'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const count = async t => { const r = await sb.from(t).select('*', { count: 'exact', head: true }); if (r.error) throw r.error; return r.count; };
for (const t of ['cosmos', 'mini_cosmos', 'journal', 'propositions', 'agents']) console.log(t.padEnd(13), await count(t));
const { data: minis } = await sb.from('mini_cosmos').select('id,cosmos,name,valeur_actuelle,closed,position,updated_by,updated_at').order('updated_at', { ascending: false }).limit(5);
console.log('\nDerniers mini-cosmos modifiés :'); console.table(minis);
const { data: journal } = await sb.from('journal').select('t,author,type,mini,detail').order('created_at', { ascending: false }).limit(5);
console.log('Dernières entrées du journal :'); console.table(journal);
const { data: props } = await sb.from('propositions').select('agent_name,mini_id,statut,patch,motif,created_at').order('created_at', { ascending: false }).limit(5);
console.log('Dernières propositions :'); console.table(props);
