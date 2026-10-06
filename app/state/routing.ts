import { matchPath } from 'react-router';
export type Page = 'table' | 'echeances' | 'templates' | 'journal';
export const pagePaths: Record<Page, string> = {
  table: '/cosmos',
  echeances: '/echeances',
  templates: '/modeles',
  journal: '/journal',
};
const aliases = new Set(['/carte', '/tableau', '/statistiques', '/lentilles']);
export function readRoute(pathname: string): { view: Page; selected: string | null } {
  pathname = canonicalPath(pathname);
  for (const [view, path] of Object.entries(pagePaths)) {
    const match = matchPath({ path: path + '/:miniId?', end: true }, pathname);
    if (match) {
      let selected = match.params.miniId || null;
      try {
        if (selected) selected = decodeURIComponent(selected);
      } catch {
        /* identifiant mal encodé : aucune fiche correspondante */
      }
      return { view: view as Page, selected };
    }
  }
  return { view: 'table', selected: null };
}
export function routeUrl(view: Page, selected: string | null): string {
  return (
    (pagePaths[view] || '/cosmos') +
    ((view === 'table' || view === 'echeances') && selected
      ? '/' + encodeURIComponent(selected)
      : '')
  );
}
export function canonicalPath(pathname: string): string {
  const [_, first, ...rest] = pathname.split('/');
  if (pathname === '/' || aliases.has('/' + first))
    return '/cosmos' + (rest.length ? '/' + rest.join('/') : '');
  return pathname;
}
