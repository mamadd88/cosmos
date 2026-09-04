// Configuration publique lue par le navigateur au démarrage. Sans variables Supabase, l'app reste en localStorage.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return res.status(200).json({});
  res.status(200).json({ supabaseUrl: url, supabaseKey: key, assist: !!process.env.ANTHROPIC_API_KEY });
}
