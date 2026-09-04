// Assistant IA du volet gauche : remplace window.claude.complete (Claude Design) une fois en ligne.
// Réservé à l'utilisateur connecté ; la clé Anthropic reste côté serveur.
import Anthropic from '@anthropic-ai/sdk';
import { userFromRequest } from './_lib/supabase.js';

const MODEL = 'claude-opus-5';
const EFFORT = 'medium';          // relecture courte et structurée : medium suffit et répond plus vite

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST attendu' });
  let user;
  try { user = await userFromRequest(req); } catch (e) { return res.status(500).json({ error: e.message }); }
  if (!user) return res.status(401).json({ error: 'Connexion requise' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY manquante côté serveur (variables d’environnement Vercel)' });

  const { system, messages } = req.body || {};
  const ok = Array.isArray(messages) && messages.length > 0
    && messages.every(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  if (!ok) return res.status(400).json({ error: 'messages invalides' });
  if (JSON.stringify(messages).length + String(system || '').length > 60000) return res.status(413).json({ error: 'demande trop longue' });

  const client = new Anthropic();
  const params = { model: MODEL, max_tokens: 8000, messages, output_config: { effort: EFFORT } };
  if (typeof system === 'string' && system) params.system = system;

  let response;
  try {
    // Repli serveur par défaut : si le modèle décline, l'API rejoue la demande sur un modèle de secours.
    response = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      console.warn('assist : paramètre fallbacks refusé, nouvel essai sans —', e.message);
      try { response = await client.messages.create(params); } catch (e2) { return apiError(res, e2); }
    } else return apiError(res, e);
  }
  if (response.stop_reason === 'refusal') {
    const why = response.stop_details?.explanation;
    return res.status(422).json({ error: 'Le modèle a décliné cette demande' + (why ? ' : ' + why : '') });
  }
  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text) return res.status(502).json({ error: 'réponse vide (' + response.stop_reason + ')' });
  res.status(200).json({ text, model: response.model, usage: { input: response.usage?.input_tokens, output: response.usage?.output_tokens } });
}

function apiError(res, e) {
  if (e instanceof Anthropic.AuthenticationError) return res.status(502).json({ error: 'Clé Anthropic invalide' });
  if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Limite de débit Anthropic atteinte, réessaie dans un instant' });
  if (e instanceof Anthropic.APIError) return res.status(502).json({ error: 'Erreur API Anthropic ' + e.status + ' : ' + e.message });
  return res.status(500).json({ error: e?.message || String(e) });
}
