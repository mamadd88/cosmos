import { useCosmos } from '../state/CosmosContext';

export default function Toast() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.toast ? (
        <>
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: '50',
              background: '#0c0c0e',
              border: '1px solid rgba(39,39,42,0.9)',
              borderRadius: '12px',
              padding: '10px 14px',
              fontSize: '12.5px',
              color: '#f4f4f5',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              animation: 'popin 180ms ease',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#34d399' }}></span>
            {v.toast}
          </div>
        </>
      ) : null}
    </>
  );
}
