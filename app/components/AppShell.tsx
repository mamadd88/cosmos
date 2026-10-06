import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { useCosmos } from '../state/CosmosContext';
import Header from './Header';
import Loading from './Loading';
import Login from './Login';
import Toast from './Toast';
import ConflictBanner from './ConflictBanner';
const MiniDetails = lazy(() => import('./MiniDetails'));
const AgentsModal = lazy(() => import('./AgentsModal'));
const CosmosModal = lazy(() => import('./CosmosModal'));
const MiniModal = lazy(() => import('./MiniModal'));
export default function AppShell() {
  const { values: v, controller } = useCosmos();
  const { syncRefreshing, ready, bootError } = controller.state;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      {syncRefreshing && ready ? (
        <div className="sync-status" role="status">
          <span>
            {bootError
              ? 'Connexion indisponible. La dernière copie reste affichée en lecture seule.'
              : 'Dernière copie affichée · Actualisation en cours…'}
          </span>
          {bootError ? <button onClick={() => controller.bootDb()}>Réessayer</button> : null}
          <button onClick={() => controller.logout()}>Se déconnecter</button>
        </div>
      ) : null}
      <div inert={syncRefreshing && ready} aria-busy={syncRefreshing}>
        <Header />
        <Loading />
        <Login />
        <Outlet />
        <Suspense
          fallback={
            <div className="panel-loading" role="status">
              Chargement du volet…
            </div>
          }
        >
          {v.detail ? <MiniDetails /> : null}
          {v.showAgents ? <AgentsModal /> : null}
          {v.showCosmosModal ? <CosmosModal /> : null}
          {v.showMiniModal ? <MiniModal /> : null}
        </Suspense>
        <ConflictBanner />
        <Toast />
      </div>
    </div>
  );
}
