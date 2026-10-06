import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { JSDOM, VirtualConsole } from 'jsdom';

// Exécute le vrai build dans un DOM simulé, sans navigateur et sans accès réseau.
if (!process.argv[2]) {
  const root = new URL('../build/client/', import.meta.url);
  const assets = await readdir(new URL('assets/', root));
  const code = (
    await Promise.all(
      assets
        .filter((name) => name.endsWith('.js'))
        .map((name) => readFile(new URL('assets/' + name, root), 'utf8')),
    )
  ).join('\n');
  const { loadEnv } = await import('vite');
  const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY']) {
    if (env[key]) assert.ok(!code.includes(env[key]), `${key} ne doit pas apparaître dans le build public`);
  }
  const mode = /supabaseUrl\s*:\s*[`'"]https?:/.test(code) ? 'supabase' : 'local';
  for (const path of ['/cosmos', '/#/cosmos', '/#/echeances', '/journal']) {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [new URL(import.meta.url).pathname, path, mode],
      { timeout: 10000 },
    );
    process.stdout.write(stdout);
  }
} else {
  const path = process.argv[2];
  const mode = process.argv[3];
  const root = new URL('../build/client/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.doesNotMatch(html, /support\.js|text\/x-dc|unpkg|Cosmos\.dc\.html/);
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(String(error)));
  const dom = new JSDOM(html, {
    url: 'http://localhost:8123' + path,
    runScripts: 'dangerously',
    virtualConsole,
    beforeParse(window) {
      Object.assign(window, {
        ReadableStream,
        TextEncoderStream,
        TextDecoderStream,
        TextEncoder,
        TextDecoder,
        scrollTo() {},
      });
    },
  });
  for (const key of [
    'window',
    'document',
    'location',
    'history',
    'localStorage',
    'HTMLElement',
    'Node',
    'MutationObserver',
    'navigator',
  ])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.self = dom.window;
  globalThis.fetch = dom.window.fetch = async () => {
    throw new Error('Accès réseau inattendu dans le test du build');
  };
  console.error = (...args) => errors.push(args.map(String).join(' '));
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(
        specifier.startsWith('/assets/') ? new URL(specifier.slice(1), root).href : specifier,
        context,
      );
    },
  });
  const moduleScript = [...document.querySelectorAll('script[type="module"]')]
    .map((s) => s.textContent)
    .join('\n');
  await import('data:text/javascript,' + encodeURIComponent(moduleScript));
  const isReady = () =>
    mode === 'supabase'
      ? [...document.querySelectorAll('button')].some((b) => b.textContent === 'Se connecter')
      : !!document.querySelector('.cosmos-table .ct-floor, .echeance-row, .journal-mini') ||
        document.body.textContent.includes('aucune entrée');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !isReady()) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(isReady(), 'le build doit démarrer sur la connexion Supabase ou les données locales');
  assert.deepEqual(errors, [], 'aucune erreur de chargement ni de réconciliation React');
  const target = path.includes('#/') ? path.split('#')[1] : path;
  assert.equal(location.pathname, target);
  if (target === '/cosmos' && mode === 'local') {
    assert.equal(document.querySelectorAll('.cosmos-table .ct-floor').length, 3);
    assert.ok(document.body.textContent.includes('ETHOS — LA CRÉDIBILITÉ'));
    assert.equal(document.querySelector('.etage-title-row'), null);
  }
  assert.equal(location.hash, '');
  console.log(`Build vérifié : ${path} → ${location.pathname}, mode ${mode}, sans accès réseau`);
  process.exit(0);
}
