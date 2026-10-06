import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

function apiDev(): Plugin {
  const middleware = async (
    req: IncomingMessage & { body?: unknown },
    res: ServerResponse,
    next: () => void,
  ) => {
    const route = req.url?.split('?')[0];
    const handlers = {
      '/api/config': () => import('./api/config.js'),
      '/api/assist': () => import('./api/assist.js'),
      '/api/agent': () => import('./api/agent.js'),
    };
    const load = handlers[route as keyof typeof handlers];
    if (!load) return next();
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 100_000) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks).toString();
        req.body = raw ? JSON.parse(raw) : {};
      }
      const response = Object.assign(res, {
        status(code: number) {
          res.statusCode = code;
          return response;
        },
        json(body: unknown) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
          return response;
        },
      });
      await (await load()).default(req, response);
    } catch (error) {
      console.error('API locale', error);
      if (!res.headersSent) res.writeHead(500);
      res.end(JSON.stringify({ error: 'Erreur du serveur local' }));
    }
  };
  return {
    name: 'cosmos-api-dev',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY'])
    if (env[key]) process.env[key] = env[key];
  // Seules ces valeurs publiques sont incluses dans le navigateur. Aucune clé serveur.
  const config = {
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseKey: env.SUPABASE_ANON_KEY || '',
    assist: !!env.ANTHROPIC_API_KEY,
  };
  if (
    !!config.supabaseUrl !== !!config.supabaseKey ||
    [config.supabaseUrl, config.supabaseKey].includes('[SENSITIVE]')
  ) {
    throw new Error(
      'SUPABASE_URL et SUPABASE_ANON_KEY doivent contenir les deux valeurs publiques réelles. Pour un build Vercel local, remplacer les valeurs [SENSITIVE] dans .vercel/.env.production.local.',
    );
  }
  if (config.supabaseUrl && (!URL.canParse(config.supabaseUrl) || !/^https?:/.test(config.supabaseUrl))) {
    throw new Error('SUPABASE_URL doit être une URL HTTP ou HTTPS valide.');
  }
  return {
    plugins: [apiDev(), reactRouter()],
    define: { __COSMOS_CONFIG__: JSON.stringify(config) },
    server: { port: 8123, strictPort: true },
    preview: { port: 8124, strictPort: true },
  };
});
