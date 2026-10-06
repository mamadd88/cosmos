import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';
import { canonicalPath } from './state/routing';
// Les anciens favoris #/... restent valides, sans double chargement de la page.
if (window.location.hash.startsWith('#/')) {
  history.replaceState(null, '', canonicalPath(window.location.hash.slice(1)));
}
startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});
