import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function AgentsModal() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.showAgents ? (
        <>
          <div
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: '40',
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'fadein 150ms ease',
            }}
          >
            <div
              style={{
                width: '600px',
                maxHeight: '90vh',
                background: '#0c0c0e',
                border: '1px solid rgba(39,39,42,0.9)',
                borderRadius: '20px',
                animation: 'popin 180ms ease',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '20px 22px 16px',
                  borderBottom: '1px solid rgba(39,39,42,0.8)',
                }}
              >
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: '700',
                      color: '#fafafa',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {'Agents IA'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#71717a' }}>
                    {'une clé par agent, une seule porte (/api/agent), seuls les changements de Valeur actuelle sont journalisés'}
                  </div>
                </div>

                <button
                  onClick={v.closeAgents}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                  className={'cosmos-hover-57'}
                >
                  {'✕'}
                </button>
              </div>

              <div
                style={{
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                }}
              >
                {v.hasNewAgentKey ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(52,211,153,0.4)',
                        background: 'rgba(52,211,153,0.07)',
                      }}
                    >
                      <div style={{ fontSize: '11.5px', fontWeight: '600', color: '#34d399' }}>
                        {'Clé de « ' +
                          (v.newAgentKeyName ?? '') +
                          ' » — copie-la maintenant, elle ne sera plus jamais affichée'}
                      </div>

                      <div
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: '12px',
                          color: '#f4f4f5',
                          wordBreak: 'break-all',
                          userSelect: 'all',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#09090b',
                        }}
                      >
                        {v.newAgentKey}
                      </div>

                      <div style={{ fontSize: '11px', color: '#71717a', lineHeight: '1.6' }}>
                        {"L'agent appelle " +
                          (v.agentEndpoint ?? '') +
                          " en POST avec l'en-tête Authorization: Bearer <clé> et un corps JSON dont le champ action vaut lire, proposer ou modifier. Un GET sur la même adresse renvoie la documentation."}
                      </div>

                      <button
                        onClick={v.clearNewAgentKey}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'transparent',
                          border: '1px solid #27272a',
                          color: '#a1a1aa',
                          padding: '4px 11px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                        }}
                        className={'cosmos-hover-58'}
                      >
                        {"J'ai copié la clé"}
                      </button>
                    </div>
                  </>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: '#52525b',
                    }}
                  >
                    {'Agents déclarés · ' + (v.agentsCount ?? '') + ''}
                  </div>

                  {v.noAgents ? (
                    <>
                      <div style={{ fontSize: '12px', color: '#52525b' }}>{"aucun agent pour l'instant"}</div>
                    </>
                  ) : null}

                  {(v.agents ?? []).map((a: ViewItem, $index: number) => (
                    <Fragment key={listKey(a, $index)}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          borderRadius: '12px',
                          border: '1px solid rgba(39,39,42,0.8)',
                          background: '#0f0f12',
                        }}
                      >
                        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: a?.color,
                              textDecoration: a?.deco,
                            }}
                          >
                            {a?.name}
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: '11px',
                              color: '#71717a',
                            }}
                          >
                            {'' + (a?.level ?? '') + ' · ' + (a?.lastUsed ?? '') + ''}
                          </span>
                        </div>

                        {a?.isActive ? (
                          <>
                            <button
                              onClick={a?.revoke}
                              style={{
                                background: 'transparent',
                                border: '1px solid #27272a',
                                color: '#a1a1aa',
                                padding: '4px 11px',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                              }}
                              className={'cosmos-hover-59'}
                            >
                              {'Révoquer'}
                            </button>
                          </>
                        ) : null}

                        {a?.isRevoked ? (
                          <>
                            <span style={{ fontSize: '11px', color: '#52525b' }}>{'révoqué'}</span>
                          </>
                        ) : null}
                      </div>
                    </Fragment>
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    padding: '14px',
                    borderRadius: '12px',
                    border: '1px solid rgba(39,39,42,0.8)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10.5px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      color: '#52525b',
                    }}
                  >
                    {'Nouvel agent'}
                  </div>

                  <input
                    value={v.newAgentName ?? ''}
                    onChange={v.setNewAgentName}
                    onKeyDown={v.newAgentKeyDown}
                    placeholder={'nom (ex. relecture-du-matin)'}
                    style={{
                      background: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: '#f4f4f5',
                    }}
                  />

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(v.agentLevelChips ?? []).map((c: ViewItem, $index: number) => (
                      <Fragment key={listKey(c, $index)}>
                        <button
                          onClick={c?.onClick}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '99px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: c?.color,
                            background: c?.bg,
                            border: '1px solid ' + (c?.border ?? '') + '',
                          }}
                        >
                          {c?.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>

                  <div style={{ fontSize: '11px', color: '#71717a', lineHeight: '1.6' }}>
                    {v.agentLevelHint}
                  </div>

                  <button
                    onClick={v.createAgent}
                    disabled={v.newAgentInvalid}
                    style={{
                      alignSelf: 'flex-start',
                      background: '#fafafa',
                      color: '#09090b',
                      border: 'none',
                      padding: '8px 15px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: v.newAgentBtnOpacity,
                    }}
                    className={'cosmos-hover-60'}
                  >
                    {'Créer et afficher la clé'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
