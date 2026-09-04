// Crée l'utilisateur de Cosmos (ou change son mot de passe). Mono-utilisateur : à lancer une fois.
// Usage : node --env-file=.env.local scripts/creer-utilisateur.mjs <email> [mot de passe]
//         (sans mot de passe en argument, la variable COSMOS_PASSWORD est utilisée)
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [email, argPassword] = process.argv.slice(2);
const password = argPassword || process.env.COSMOS_PASSWORD;
if (!email || !password) { console.error('Usage : node --env-file=.env.local scripts/creer-utilisateur.mjs <email> [mot de passe]'); process.exit(1); }
if (password.length < 8) { console.error('Mot de passe : 8 caractères minimum'); process.exit(1); }
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (dans .env.local)'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: list, error: le } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (le) { console.error(le.message); process.exit(1); }
const existing = list.users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
if (existing) {
  const { error } = await sb.auth.admin.updateUserById(existing.id, { password });
  if (error) { console.error(error.message); process.exit(1); }
  console.log('Mot de passe mis à jour pour', email, '· id', existing.id);
} else {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.error(error.message); process.exit(1); }
  console.log('Utilisateur créé :', email, '· id', data.user.id);
}
// Garde .env.local en phase : COSMOS_PASSWORD y devient le mot de passe donné en argument
// (seulement pour le compte principal : COSMOS_EMAIL, ou le premier compte si cette variable est absente)
if (argPassword && existsSync('.env.local')) {
  const known = (process.env.COSMOS_EMAIL || '').toLowerCase();
  if (known && known !== email.toLowerCase()) {
    console.log('.env.local non modifié : COSMOS_EMAIL est', process.env.COSMOS_EMAIL);
  } else {
    const lines = readFileSync('.env.local', 'utf8').split('\n').filter(l => !l.startsWith('COSMOS_PASSWORD=') && !l.startsWith('COSMOS_EMAIL='));
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    writeFileSync('.env.local', [...lines, 'COSMOS_EMAIL=' + email, 'COSMOS_PASSWORD=' + argPassword, ''].join('\n'));
    console.log('COSMOS_EMAIL et COSMOS_PASSWORD mis à jour dans .env.local');
  }
}
