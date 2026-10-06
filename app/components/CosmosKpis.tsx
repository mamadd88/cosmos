import { useCosmos } from '../state/CosmosContext';

export default function CosmosKpis() {
  const { values } = useCosmos();
  return (
    <div
      role="group"
      aria-label="Indicateurs Cosmos"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '22px',
        maxWidth: '100%',
        padding: '10px 20px',
        borderRadius: '14px',
        border: '1px solid rgba(39,39,42,0.8)',
        background: 'rgba(24,24,27,0.5)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {(values.kpiCards ?? []).map((kpi) => (
        <div
          key={kpi.label}
          title={kpi.title}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            minWidth: '44px',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '18px',
              fontWeight: '600',
              lineHeight: '1',
              color: kpi.color,
            }}
          >
            {kpi.value}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#52525b',
              whiteSpace: 'nowrap',
            }}
          >
            {kpi.label}
          </span>
        </div>
      ))}
    </div>
  );
}
