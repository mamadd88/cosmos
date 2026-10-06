import { useCosmos } from '../state/CosmosContext';

export default function Loading() {
  const { values: v, controller } = useCosmos();
  return (
    <>
      {v.booting ? (
        <>
          <div
            style={{
              padding: '60px',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '13px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#a1a1aa',
            }}
          >
            {'Chargement… '}
            <span style={{ color: '#fb7185', textTransform: 'none', letterSpacing: '0' }}>{v.bootError}</span>
            {v.bootError ? (
              <button onClick={() => (controller.sync ? controller.bootDb() : window.location.reload())}>
                Réessayer
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
