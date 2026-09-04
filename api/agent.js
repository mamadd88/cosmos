// Porte unique des agents IA. Un agent s'authentifie avec sa propre clé (créée dans l'app, menu Données › Agents IA) ;
// seule l'empreinte SHA-256 est en base. Les règles (champs autorisés, niveau d'écriture, trace dans le journal)
// vivent dans les fonctions SQL agent_* ; ce fichier ne fait qu'authentifier et router.
import { admin, bearer, sha256 } from './_lib/supabase.js';

const CHAMPS = { objectif: '…', actuel: '…', entropie: '…', reponse: '…', sas: '…', sasUntil: 'AAAA-MM-JJ (fin du test)', alerte: '…', kill: '…', etapes: ['…'], tags: ['lentille existante'], poids: 'vital | important | normal' };
const DOC = {
  description: 'Porte des agents IA de Cosmos. Authentification : Authorization: Bearer <clé d’agent>. Corps JSON : {"action": "...", ...}. Les identifiants mini_id sont ceux renvoyés par « lire » (champ id).',
  actions: {
    lire:     { corps: {}, resultat: 'agent, cosmos, miniCosmos (objets complets), propositionsEnAttente, journalRecent' },
    proposer: { corps: { mini_id: 'mc-…', patch: CHAMPS, motif: 'pourquoi (facultatif)' }, resultat: 'propositionId — rien n’est modifié tant que l’utilisateur n’accepte pas dans l’app' },
    modifier: { corps: { mini_id: 'mc-…', patch: CHAMPS, detail: 'texte pour le journal (facultatif)' }, resultat: 'objet mis à jour — réservé aux agents avec écriture directe ; toujours tracé' },
    noter:    { corps: { detail: 'texte', mini_id: 'mc-… (facultatif)' }, resultat: 'entrée de journal de type note' },
  },
  patch: 'Seuls les champs listés sont acceptés ; « etapes » ajoute des étapes (les doublons sont ignorés), « tags » remplace la liste des lentilles (noms existants, renvoyés par « lire »), « poids » vaut vital, important ou normal (il ordonne le tableau et hiérarchise), les autres remplacent le texte.',
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json(DOC);
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET (documentation) ou POST attendu' });

  const key = bearer(req);
  if (!key) return res.status(401).json({ error: 'En-tête Authorization: Bearer <clé d’agent> requis' });
  let sb;
  try { sb = admin(); } catch (e) { return res.status(500).json({ error: e.message }); }

  const { data: agent, error: authErr } = await sb.rpc('agent_verifier', { p_key_hash: sha256(key) });
  if (authErr) return res.status(500).json({ error: authErr.message });
  if (!agent) return res.status(401).json({ error: 'Clé d’agent inconnue ou révoquée' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const action = String(body.action || '');
  const calls = {
    lire:     () => sb.rpc('agent_lire',     { p_agent_id: agent.id }),
    proposer: () => sb.rpc('agent_proposer', { p_agent_id: agent.id, p_mini_id: body.mini_id ?? null, p_patch: body.patch ?? null, p_motif: body.motif ?? null }),
    modifier: () => sb.rpc('agent_modifier', { p_agent_id: agent.id, p_mini_id: body.mini_id ?? null, p_patch: body.patch ?? null, p_detail: body.detail ?? null }),
    noter:    () => sb.rpc('agent_noter',    { p_agent_id: agent.id, p_detail: body.detail ?? null, p_mini_id: body.mini_id ?? null }),
  };
  if (!calls[action]) return res.status(400).json({ error: 'action inconnue : « ' + action + ' »', actions: Object.keys(calls) });

  const { data, error } = await calls[action]();
  if (error) return res.status(error.code === 'P0001' ? 422 : 500).json({ error: error.message, agent: agent.nom });
  res.status(200).json({ ok: true, agent: agent.nom, action, resultat: data });
}
