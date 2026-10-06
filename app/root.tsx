import type { ReactNode } from 'react';
import { Links, Meta, Scripts, ScrollRestoration, isRouteErrorResponse, useRouteError } from 'react-router';
import { CosmosProvider } from './state/CosmosContext';
import AppShell from './components/AppShell';
import './styles/app.css';
import './styles/cosmos.css';
export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Cosmos</title>
        <Meta />
        <Links />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export function HydrateFallback() {
  return (
    <div className="startup" role="status">
      Chargement de Cosmos…
    </div>
  );
}
export default function App() {
  return (
    <CosmosProvider>
      <AppShell />
    </CosmosProvider>
  );
}
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <main className="startup">
      <h1>Cosmos n’a pas pu s’afficher</h1>
      <p>{isRouteErrorResponse(error) ? error.statusText : 'Recharge la page pour réessayer.'}</p>
      <a href="/cosmos">Recharger Cosmos</a>
    </main>
  );
}
