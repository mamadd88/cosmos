import { useCosmos } from '../state/CosmosContext';

export default function ConflictBanner() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.syncConflict ? (
        <>
          <div
            role={'alert'}
            style={{
              position: 'fixed',
              bottom: '20px',
              left: '20px',
              right: '20px',
              zIndex: '49',
              background: '#18181b',
              border: '1px solid #fbbf24',
              borderRadius: '12px',
              padding: '16px',
              color: '#f4f4f5',
              fontSize: '13px',
            }}
          >
            <strong>{'Conflit de sauvegarde'}</strong>
            <div style={{ margin: '6px 0' }}>
              {'' +
                (v.syncConflict ?? '') +
                ' Les modifications locales restent dans cet onglet. Exporte-les avant de charger la version synchronisée.'}
            </div>

            <button
              onClick={v.resolveSyncConflict}
              disabled={v.syncConflictBusy}
              style={{
                border: '0',
                borderRadius: '8px',
                padding: '8px 12px',
                background: '#fafafa',
                color: '#09090b',
                cursor: 'pointer',
              }}
            >
              {'Exporter mes modifications puis recharger'}
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
