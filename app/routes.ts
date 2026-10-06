import { route, index, type RouteConfig } from '@react-router/dev/routes';
export default [
  index('routes/redirect.tsx'),
  route('cosmos/:miniId?', 'routes/cosmos.tsx'),
  route('echeances/:miniId?', 'routes/echeances.tsx'),
  route('journal', 'routes/journal.tsx'),
  route('modeles', 'routes/modeles.tsx'),
  route('*', 'routes/fallback.tsx'),
] satisfies RouteConfig;
