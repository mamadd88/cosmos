// Outils partagés par les fonctions serveur. Les clés sensibles ne quittent jamais ce processus.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export function admin() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquantes côté serveur');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function bearer(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

// Utilisateur connecté à l'app (jeton de session Supabase transmis par le navigateur)
export async function userFromRequest(req) {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error || !data?.user ? null : data.user;
}

export const sha256 = s => createHash('sha256').update(s).digest('hex');
