import { Link } from 'react-router';
import { useCosmos } from '../state/CosmosContext';

export default function Header() {
  const { values: v } = useCosmos();
  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: '0',
          zIndex: '20',
          height: '58px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '0 24px',
          background: 'rgba(9,9,11,0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(39,39,42,0.8)',
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: '700',
            letterSpacing: '0.22em',
            color: '#fafafa',
            textTransform: 'uppercase',
          }}
        >
          {'Cosmos'}
        </div>

        <div
          style={{
            display: 'flex',
            padding: '4px',
            borderRadius: '13px',
            border: '1px solid rgba(39,39,42,0.8)',
            background: 'rgba(24,24,27,0.5)',
            gap: '2px',
          }}
        >
          <Link
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
              color: v.tabTable?.color,
              background: v.tabTable?.bg,
              border: '1px solid ' + (v.tabTable?.border ?? '') + '',
            }}
            to={'/cosmos'}
            className={'cosmos-hover-0'}
          >
            {'Cosmos'}
          </Link>

          <Link
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
              color: v.tabEch?.color,
              background: v.tabEch?.bg,
              border: '1px solid ' + (v.tabEch?.border ?? '') + '',
            }}
            to={'/echeances'}
            className={'cosmos-hover-1'}
          >
            {'Échéances'}
          </Link>

          <Link
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
              color: v.tabTpl?.color,
              background: v.tabTpl?.bg,
              border: '1px solid ' + (v.tabTpl?.border ?? '') + '',
            }}
            to={'/modeles'}
            className={'cosmos-hover-2'}
          >
            {'Modèles'}
          </Link>

          <Link
            style={{
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
              color: v.tabJournal?.color,
              background: v.tabJournal?.bg,
              border: '1px solid ' + (v.tabJournal?.border ?? '') + '',
            }}
            to={'/journal'}
            className={'cosmos-hover-3'}
          >
            {'Journal'}
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            position: 'relative',
          }}
        >
          <button
            onClick={v.toggleDataMenu}
            title={'Exporter en JSON (menu Données)'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: '11px',
              color: v.lastExportColor,
              whiteSpace: 'nowrap',
            }}
            className={'cosmos-hover-4'}
          >
            {v.lastExportLabel}
          </button>

          {v.hasPending ? (
            <>
              <button
                onClick={v.openPending}
                title={"Propositions d'agents en attente"}
                style={{
                  height: '32px',
                  padding: '0 11px',
                  borderRadius: '10px',
                  border: '1px solid rgba(192,132,252,0.45)',
                  background: 'rgba(192,132,252,0.1)',
                  color: '#c084fc',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                className={'cosmos-hover-5'}
              >
                {'✦ ' + (v.pendingCount ?? '') + ''}
              </button>
            </>
          ) : null}

          <button
            onClick={v.toggleDataMenu}
            title={'Données'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              border: '1px solid #27272a',
              background: '#09090b',
              color: '#a1a1aa',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className={'cosmos-hover-6'}
          >
            <svg
              width={'14'}
              height={'14'}
              viewBox={'0 0 24 24'}
              fill={'none'}
              stroke={'currentColor'}
              strokeWidth={'2'}
              strokeLinecap={'round'}
              strokeLinejoin={'round'}
            >
              <ellipse cx={'12'} cy={'5'} rx={'9'} ry={'3'}></ellipse>
              <path d={'M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5'}></path>
              <path d={'M3 12c0 1.7 4 3 9 3s9-1.3 9-3'}></path>
            </svg>
          </button>

          <input
            type={'file'}
            accept={'application/json,.json'}
            ref={v.importRef}
            onChange={v.importJson}
            style={{ display: 'none' }}
          />

          {v.dataMenu ? (
            <>
              <div
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '0',
                  zIndex: '50',
                  width: '280px',
                  background: '#0c0c0e',
                  border: '1px solid rgba(39,39,42,0.9)',
                  borderRadius: '14px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'popin 150ms ease',
                }}
              >
                <div
                  style={{
                    padding: '8px 10px 2px',
                    fontSize: '10.5px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#52525b',
                  }}
                >
                  {v.storageTitle}
                </div>

                <div
                  style={{
                    padding: '0 10px 6px',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '11px',
                    color: v.lastExportColor,
                  }}
                >
                  {v.storageHint}
                </div>

                <button
                  onClick={v.exportJson}
                  style={{
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#f4f4f5',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                  className={'cosmos-hover-7'}
                >
                  <span>{'Exporter en JSON'}</span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                    {'cosmos, mini-cosmos, étapes, historique'}
                  </span>
                </button>

                <button
                  onClick={v.openImport}
                  style={{
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#f4f4f5',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                  className={'cosmos-hover-8'}
                >
                  <span>{'Importer un JSON'}</span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                    {'remplace les données actuelles'}
                  </span>
                </button>

                <div style={{ height: '1px', background: 'rgba(39,39,42,0.8)', margin: '4px 6px' }}></div>

                {v.confirmReset ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: 'rgba(244,63,94,0.1)',
                        fontSize: '12px',
                        color: '#fb7185',
                      }}
                    >
                      {"Tout remplacer par l'exemple ?"}
                      <span style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={v.cancelReset}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#a1a1aa',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          {'Non'}
                        </button>
                        <button
                          onClick={v.resetData}
                          style={{
                            background: '#fb7185',
                            border: 'none',
                            color: '#09090b',
                            fontWeight: '600',
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          {'Oui'}
                        </button>
                      </span>
                    </div>
                  </>
                ) : null}

                <button
                  onClick={v.askReset}
                  style={{
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                  }}
                  className={'cosmos-hover-9'}
                >
                  {"Restaurer les données d'exemple"}
                </button>

                {v.isDb ? (
                  <>
                    <div style={{ height: '1px', background: 'rgba(39,39,42,0.8)', margin: '4px 6px' }}></div>

                    <button
                      onClick={v.openAgents}
                      style={{
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#f4f4f5',
                        padding: '9px 10px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                      className={'cosmos-hover-10'}
                    >
                      <span>{'Agents IA'}</span>
                      <span style={{ fontSize: '11px', color: '#71717a' }}>{v.agentsHint}</span>
                    </button>

                    <button
                      onClick={v.logout}
                      style={{
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#a1a1aa',
                        padding: '9px 10px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                      }}
                      className={'cosmos-hover-11'}
                    >
                      {'Se déconnecter'}
                    </button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}

          <button
            onClick={v.openCosmos}
            style={{
              background: '#09090b',
              color: '#a1a1aa',
              border: '1px solid #27272a',
              padding: '7px 12px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '500',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            className={'cosmos-hover-12'}
          >
            {'+ cosmos'}
          </button>

          <button
            onClick={v.openMini}
            style={{
              background: '#fafafa',
              color: '#09090b',
              border: 'none',
              padding: '7px 13px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            className={'cosmos-hover-13'}
          >
            {'+ mini-cosmos'}
          </button>
        </div>
      </div>
    </>
  );
}
