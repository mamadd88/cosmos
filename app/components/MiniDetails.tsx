import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function MiniDetails() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.detail ? (
        <>
          <div
            onClick={v.closeDetail}
            style={{
              position: 'fixed',
              inset: '0',
              zIndex: '30',
              background: 'rgba(0,0,0,0.35)',
              animation: 'fadein 150ms ease',
            }}
          ></div>

          <div
            style={{
              position: 'fixed',
              top: '0',
              right: '640px',
              bottom: '0',
              width: '400px',
              zIndex: '31',
              background: '#0a0a0c',
              borderLeft: '1px solid rgba(99,102,241,0.25)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slidein 260ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '20px 20px 16px',
                borderBottom: '1px solid rgba(39,39,42,0.8)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#f4f4f5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span style={{ color: '#818cf8' }}>{'✦'}</span>
                  {'Assistant IA'}
                </div>

                <div style={{ fontSize: '11px', color: '#71717a' }}>
                  {"relecture — ce que tu n'as pas vu · reformuler · incohérences"}
                </div>
              </div>

              <button
                onClick={v.detail?.ai?.run}
                style={{
                  background: '#818cf8',
                  color: '#09090b',
                  border: 'none',
                  padding: '8px 13px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: v.detail?.ai?.btnOpacity,
                  whiteSpace: 'nowrap',
                }}
                className={'cosmos-hover-36'}
              >
                {v.detail?.ai?.btnLabel}
              </button>
            </div>

            <div
              style={{
                flex: '1',
                overflowY: 'auto',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              {v.detail?.hasAgentProps ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        color: '#c084fc',
                      }}
                    >
                      {"Propositions d'agents · " + (v.detail?.agentPropsCount ?? '') + ''}
                    </div>

                    {(v.detail?.agentProps ?? []).map((p: ViewItem, $index: number) => (
                      <Fragment key={listKey(p, $index)}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(192,132,252,0.35)',
                            background: 'rgba(192,132,252,0.06)',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#c084fc' }}>
                            {'✦ ' + (p?.agent ?? '') + ''}
                          </div>

                          {(p?.lines ?? []).map((l: ViewItem, $index: number) => (
                            <Fragment key={listKey(l, $index)}>
                              <div style={{ fontSize: '12.5px', lineHeight: '1.5' }}>
                                <span style={{ color: '#71717a' }}>{'' + (l?.label ?? '') + ' · '}</span>
                                <span style={{ color: '#f4f4f5' }}>{l?.value}</span>
                              </div>
                            </Fragment>
                          ))}

                          {p?.hasMotif ? (
                            <>
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#a1a1aa',
                                  lineHeight: '1.5',
                                  fontStyle: 'italic',
                                }}
                              >
                                {p?.motif}
                              </div>
                            </>
                          ) : null}

                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={p?.accept}
                              style={{
                                background: '#fafafa',
                                color: '#09090b',
                                border: 'none',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                              className={'cosmos-hover-37'}
                            >
                              {'Accepter'}
                            </button>
                            <button
                              onClick={p?.refuse}
                              style={{
                                background: 'transparent',
                                border: '1px solid #27272a',
                                color: '#a1a1aa',
                                padding: '4px 11px',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                              }}
                              className={'cosmos-hover-38'}
                            >
                              {'Refuser'}
                            </button>
                          </div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </>
              ) : null}

              {v.detail?.ai?.idle ? (
                <>
                  <div style={{ fontSize: '12px', color: '#71717a', lineHeight: '1.65' }}>
                    {
                      "L'assistant lit le nom, l'objectif et tout ce que tu as écrit sur ce mini-cosmos. Il ne répète rien : il propose les entropies que tu n'as pas vues, un SAS borné, les étapes manquantes, des seuils plus mesurables — et signale ce qui cloche."
                    }
                    <br />
                    <br />
                    <span style={{ color: '#52525b' }}>
                      {"Rien n'est écrit sans que tu cliques « Utiliser »."}
                    </span>
                  </div>
                </>
              ) : null}

              {v.detail?.ai?.loading ? (
                <>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: '11.5px',
                      color: '#a1a1aa',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '99px',
                        background: '#818cf8',
                        animation: 'pulse 1.2s ease-in-out infinite',
                      }}
                    ></span>
                    {"l'assistant relit…"}
                  </div>
                </>
              ) : null}

              {v.detail?.ai?.hasError ? (
                <>
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(244,63,94,0.1)',
                      fontSize: '12px',
                      color: '#fb7185',
                      lineHeight: '1.5',
                    }}
                  >
                    {v.detail?.ai?.error}
                  </div>
                </>
              ) : null}

              {v.detail?.ai?.hasRemarque ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        color: '#fbbf24',
                      }}
                    >
                      {'Remarque'}
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        fontSize: '12.5px',
                        color: '#fbbf24',
                        lineHeight: '1.6',
                      }}
                    >
                      {v.detail?.ai?.remarque}
                    </div>
                  </div>
                </>
              ) : null}

              {v.detail?.ai?.has ? (
                <>
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
                      {'Entropie → réponse'}
                    </div>

                    {(v.detail?.ai?.entropies ?? []).map((e: ViewItem, $index: number) => (
                      <Fragment key={listKey(e, $index)}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(39,39,42,0.8)',
                            background: '#0f0f12',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              fontSize: '12.5px',
                              lineHeight: '1.5',
                            }}
                          >
                            <span style={{ color: '#a1a1aa' }}>{e?.entropie}</span>
                            <span style={{ color: '#f4f4f5' }}>{'→ ' + (e?.reponse ?? '') + ''}</span>
                          </div>

                          <button
                            onClick={e?.use}
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
                            className={'cosmos-hover-39'}
                          >
                            {'Utiliser'}
                          </button>
                        </div>
                      </Fragment>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        color: '#818cf8',
                      }}
                    >
                      {"SAS — test d'entrée"}
                    </div>

                    {(v.detail?.ai?.sas ?? []).map((e: ViewItem, $index: number) => (
                      <Fragment key={listKey(e, $index)}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(99,102,241,0.3)',
                            background: 'rgba(99,102,241,0.06)',
                          }}
                        >
                          <span style={{ fontSize: '12.5px', color: '#f4f4f5', lineHeight: '1.5' }}>
                            {e?.text}
                          </span>

                          <button
                            onClick={e?.use}
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
                            className={'cosmos-hover-40'}
                          >
                            {'Utiliser'}
                          </button>
                        </div>
                      </Fragment>
                    ))}
                  </div>

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
                      {'Étapes manquantes'}
                    </div>

                    {(v.detail?.ai?.etapes ?? []).map((e: ViewItem, $index: number) => (
                      <Fragment key={listKey(e, $index)}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(39,39,42,0.8)',
                            background: '#0f0f12',
                          }}
                        >
                          <span
                            style={{ flex: '1', fontSize: '12.5px', color: '#f4f4f5', lineHeight: '1.5' }}
                          >
                            {e?.text}
                          </span>

                          <button
                            onClick={e?.use}
                            style={{
                              background: 'transparent',
                              border: '1px solid #27272a',
                              color: '#a1a1aa',
                              padding: '4px 11px',
                              borderRadius: '8px',
                              fontSize: '11.5px',
                              cursor: 'pointer',
                              flex: 'none',
                            }}
                            className={'cosmos-hover-41'}
                          >
                            {'Ajouter'}
                          </button>
                        </div>
                      </Fragment>
                    ))}
                  </div>

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
                      {'Seuils'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(39,39,42,0.8)',
                        background: '#0f0f12',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: '12px',
                          lineHeight: '1.5',
                        }}
                      >
                        <span style={{ color: '#fbbf24' }}>
                          {'alerte · ' + (v.detail?.ai?.alerte ?? '') + ''}
                        </span>
                        <span style={{ color: '#fb7185' }}>
                          {'kill · ' + (v.detail?.ai?.kill ?? '') + ''}
                        </span>
                      </div>

                      <button
                        onClick={v.detail?.ai?.useSeuils}
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
                        className={'cosmos-hover-42'}
                      >
                        {'Utiliser'}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div
            style={{
              position: 'fixed',
              top: '0',
              right: '0',
              bottom: '0',
              width: '640px',
              zIndex: '31',
              background: '#0c0c0e',
              borderLeft: '1px solid rgba(39,39,42,0.9)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slidein 200ms ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '20px 20px 16px',
                borderBottom: '1px solid rgba(39,39,42,0.8)',
              }}
            >
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '11px',
                    color: '#71717a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {'' +
                    (v.detail?.cosmosLabel ?? '') +
                    '' +
                    (v.detail?.titreCrumb ?? '') +
                    ' · ' +
                    (v.detail?.id ?? '') +
                    ''}
                </div>

                {v.detail?.notEditing ? (
                  <>
                    <div
                      style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        letterSpacing: '-0.01em',
                        color: '#fafafa',
                      }}
                    >
                      <span
                        onClick={v.detail?.cyclePoids}
                        title={v.detail?.poidsTitle}
                        style={{
                          display: 'inline-block',
                          width: '11px',
                          height: '11px',
                          borderRadius: '99px',
                          verticalAlign: 'middle',
                          marginRight: '10px',
                          background: v.detail?.poidsBg,
                          border: '1.5px solid ' + (v.detail?.poidsBorder ?? '') + '',
                          boxShadow: v.detail?.poidsGlow,
                          cursor: 'pointer',
                        }}
                      ></span>
                      {v.detail?.name}
                    </div>
                  </>
                ) : null}

                {v.detail?.editing ? (
                  <>
                    <input
                      value={v.detail?.raw?.name ?? ''}
                      onChange={v.detail?.edit?.name}
                      style={{
                        background: '#09090b',
                        border: '1px solid #27272a',
                        borderRadius: '10px',
                        padding: '8px 12px',
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#fafafa',
                        letterSpacing: '-0.01em',
                      }}
                    />
                  </>
                ) : null}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: v.detail?.statutColor,
                      background: v.detail?.statutBg,
                    }}
                  >
                    {v.detail?.statut}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                {v.detail?.notEditing ? (
                  <>
                    <button
                      onClick={v.detail?.toggleEdit}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid #27272a',
                        background: '#09090b',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      className={'cosmos-hover-43'}
                    >
                      <svg
                        width={'12'}
                        height={'12'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <path d={'M12 20h9'}></path>
                        <path d={'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'}></path>
                      </svg>
                      {'Modifier'}
                    </button>

                    <button
                      onClick={v.detail?.duplicate}
                      title={'Dupliquer le mini-cosmos'}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        border: '1px solid #27272a',
                        background: '#09090b',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className={'cosmos-hover-44'}
                    >
                      <svg
                        width={'13'}
                        height={'13'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <rect x={'9'} y={'9'} width={'12'} height={'12'} rx={'2'}></rect>
                        <path d={'M5 15V5a2 2 0 0 1 2-2h10'}></path>
                      </svg>
                    </button>

                    <button
                      onClick={v.askDeleteMini}
                      title={'Supprimer le mini-cosmos'}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        border: '1px solid #27272a',
                        background: '#09090b',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className={'cosmos-hover-45'}
                    >
                      <svg
                        width={'13'}
                        height={'13'}
                        viewBox={'0 0 24 24'}
                        fill={'none'}
                        stroke={'currentColor'}
                        strokeWidth={'2'}
                        strokeLinecap={'round'}
                        strokeLinejoin={'round'}
                      >
                        <path d={'M3 6h18'}></path>
                        <path d={'M8 6V4h8v2'}></path>
                        <path d={'M19 6l-1 14H6L5 6'}></path>
                        <path d={'M10 11v6'}></path>
                        <path d={'M14 11v6'}></path>
                      </svg>
                    </button>
                  </>
                ) : null}

                {v.detail?.editing ? (
                  <>
                    <button
                      onClick={v.detail?.cancelEdit}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: '1px solid #27272a',
                        background: '#09090b',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                      }}
                    >
                      {'Annuler'}
                    </button>

                    <button
                      onClick={v.detail?.toggleEdit}
                      style={{
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#fafafa',
                        color: '#09090b',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                      className={'cosmos-hover-46'}
                    >
                      {'Terminer'}
                    </button>
                  </>
                ) : null}

                <button
                  onClick={v.closeDetail}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                  className={'cosmos-hover-47'}
                >
                  {'✕'}
                </button>
              </div>
            </div>

            <div
              style={{
                flex: '1',
                overflowY: 'auto',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '26px',
              }}
            >
              {v.detail?.editError ? (
                <>
                  <div role={'alert'} style={{ color: '#fb7185', fontSize: '13px' }}>
                    {v.detail?.editError}
                  </div>
                </>
              ) : null}

              {v.detail?.allDone ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    <span style={{ fontSize: '12.5px', color: '#34d399' }}>
                      {'Toutes les étapes sont faites.'}
                    </span>

                    <button
                      onClick={v.detail?.closeIt}
                      style={{
                        background: '#34d399',
                        color: '#09090b',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      className={'cosmos-hover-48'}
                    >
                      {'Clôturer'}
                    </button>
                  </div>
                </>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#52525b',
                  }}
                >
                  <span>{'Projection'}</span>

                  {v.detail?.isDated ? (
                    <>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: v.detail?.projColor }}>
                        {'' + (v.detail?.projZoneLabel ?? '') + ' · ' + (v.detail?.projLabel ?? '') + ''}
                      </span>
                    </>
                  ) : null}

                  {v.detail?.isPermanent ? (
                    <>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#71717a' }}>
                        {'∞ Continu'}
                      </span>
                    </>
                  ) : null}
                </div>

                {v.detail?.isDated ? (
                  <>
                    <div
                      style={{
                        height: '6px',
                        borderRadius: '3px',
                        background: '#27272a',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '3px',
                          background: v.detail?.projColor,
                          width: v.detail?.projPct,
                        }}
                      ></div>
                    </div>

                    <div
                      style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#52525b' }}
                    >
                      {'' + (v.detail?.projRange ?? '') + ' · ' + (v.detail?.projPreavisLabel ?? '') + ''}
                    </div>

                    {v.detail?.projIsSas ? (
                      <>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11px',
                            color: '#818cf8',
                          }}
                        >
                          {v.detail?.projThen}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}

                {v.detail?.isPermanent ? (
                  <>
                    <div style={{ fontSize: '11.5px', color: '#52525b' }}>
                      {'objectif continu, sans échéance'}
                    </div>
                  </>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {v.detail?.notEditing ? (
                  <>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        color: '#52525b',
                      }}
                    >
                      {'Gouvernance'}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr',
                        gap: '8px 12px',
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: '11.5px',
                        lineHeight: '1.6',
                      }}
                    >
                      <span style={{ color: '#52525b' }}>{'objectif'}</span>
                      <span style={{ color: '#d4d4d8' }}>{v.detail?.objectif}</span>

                      <span style={{ color: '#52525b' }}>{'actuel'}</span>
                      <span style={{ color: '#d4d4d8' }}>{v.detail?.actuel}</span>

                      <span style={{ color: '#52525b' }}>{'entropie'}</span>
                      <span style={{ color: '#d4d4d8' }}>{v.detail?.entropie}</span>

                      <span style={{ color: '#52525b' }}>{'réponse'}</span>
                      <span style={{ color: '#d4d4d8' }}>{v.detail?.reponse}</span>

                      <span style={{ color: '#52525b' }}>{'début'}</span>
                      <span style={{ color: '#d4d4d8' }}>{v.detail?.startLabel}</span>

                      {v.detail?.projIsSas ? (
                        <>
                          <span style={{ color: '#818cf8' }}>{'fin du test'}</span>
                          <span style={{ color: v.detail?.projColor }}>{v.detail?.sasUntilLabel}</span>
                        </>
                      ) : null}

                      <span style={{ color: '#52525b' }}>{'clôture'}</span>
                      <span style={{ color: v.detail?.clotureColor }}>{v.detail?.clotureFinal}</span>
                    </div>
                  </>
                ) : null}

                {v.detail?.editing ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.09em',
                            color: '#52525b',
                            paddingBottom: '6px',
                            borderBottom: '1px solid rgba(39,39,42,0.6)',
                          }}
                        >
                          {'Identité'}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                            {'Cosmos parent'}
                          </label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {(v.detail?.parentChips ?? []).map((p: ViewItem, $index: number) => (
                              <Fragment key={listKey(p, $index)}>
                                <button
                                  onClick={p?.onClick}
                                  style={{
                                    padding: '5px 11px',
                                    borderRadius: '99px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: p?.color,
                                    background: p?.bg,
                                    border: '1px solid ' + (p?.border ?? '') + '',
                                    display: 'flex',
                                    gap: '7px',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '99px',
                                      background: p?.dot,
                                    }}
                                  ></span>
                                  {p?.label}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </div>

                        {v.detail?.hasTitres ? (
                          <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                                {'Titre '}
                                <span style={{ fontWeight: '400', color: '#52525b' }}>
                                  {'la séparation sous laquelle ce terrain est rangé'}
                                </span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {(v.detail?.titreChips ?? []).map((c: ViewItem, $index: number) => (
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
                            </div>
                          </>
                        ) : null}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                            {'Poids '}
                            <span style={{ fontWeight: '400', color: '#52525b' }}>
                              {'combien ce terrain pèse'}
                            </span>
                          </label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {(v.detail?.poidsChips ?? []).map((c: ViewItem, $index: number) => (
                              <Fragment key={listKey(c, $index)}>
                                <button
                                  onClick={c?.onClick}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '99px',
                                    fontSize: '11.5px',
                                    cursor: 'pointer',
                                    color: c?.color,
                                    background: c?.bg,
                                    border: '1px solid ' + (c?.border ?? '') + '',
                                    display: 'flex',
                                    gap: '6px',
                                    alignItems: 'center',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '99px',
                                      background: c?.dotBg,
                                      border: '1.5px solid ' + (c?.dotBorder ?? '') + '',
                                    }}
                                  ></span>
                                  {c?.label}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Objectif'}
                            </label>
                            <textarea
                              value={v.detail?.raw?.objectif ?? ''}
                              onChange={v.detail?.edit?.objectif}
                              rows={2}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                resize: 'vertical',
                                lineHeight: '1.6',
                              }}
                            ></textarea>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Valeur actuelle'}
                            </label>
                            <textarea
                              value={v.detail?.raw?.actuel ?? ''}
                              onChange={v.detail?.edit?.actuel}
                              rows={2}
                              placeholder={"Où en es-tu aujourd'hui ?"}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                resize: 'vertical',
                                lineHeight: '1.6',
                              }}
                            ></textarea>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.09em',
                            color: '#52525b',
                            paddingBottom: '6px',
                            borderBottom: '1px solid rgba(39,39,42,0.6)',
                          }}
                        >
                          {'Gouvernance'}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Entropie'}
                            </label>
                            <textarea
                              value={v.detail?.raw?.entropie ?? ''}
                              onChange={v.detail?.edit?.entropie}
                              rows={2}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                resize: 'vertical',
                                lineHeight: '1.6',
                              }}
                            ></textarea>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Réponse entropie'}
                            </label>
                            <textarea
                              value={v.detail?.raw?.reponse ?? ''}
                              onChange={v.detail?.edit?.reponse}
                              rows={2}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                resize: 'vertical',
                                lineHeight: '1.6',
                              }}
                            ></textarea>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#818cf8' }}>
                            {'SAS — test avant admission'}
                          </label>
                          <input
                            value={v.detail?.sasEdit ?? ''}
                            placeholder={'vide = entre directement en Actif'}
                            onChange={v.detail?.edit?.sas}
                            style={{
                              background: '#09090b',
                              border: '1px solid #27272a',
                              borderRadius: '10px',
                              padding: '9px 12px',
                              fontSize: '12.5px',
                              color: '#f4f4f5',
                            }}
                          />

                          {v.detail?.hasSas ? (
                            <>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  flexWrap: 'wrap',
                                  marginTop: '4px',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    color: '#818cf8',
                                    marginRight: '2px',
                                  }}
                                >
                                  {'Fin du test'}
                                </span>

                                {(v.detail?.sasChips ?? []).map((c: ViewItem, $index: number) => (
                                  <Fragment key={listKey(c, $index)}>
                                    <button
                                      onClick={c?.onClick}
                                      style={{
                                        padding: '3px 9px',
                                        borderRadius: '99px',
                                        fontSize: '11px',
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

                                <input
                                  type={'date'}
                                  value={v.detail?.sasUntil ?? ''}
                                  onChange={v.detail?.edit?.sasUntil}
                                  style={{
                                    background: '#09090b',
                                    border: '1px solid ' + (v.detail?.sasUntilBorder ?? '') + '',
                                    borderRadius: '8px',
                                    padding: '4px 8px',
                                    fontSize: '11.5px',
                                    color: '#f4f4f5',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                  }}
                                />
                              </div>

                              <div
                                style={{ fontSize: '11px', color: v.detail?.sasHintColor, lineHeight: '1.5' }}
                              >
                                {v.detail?.sasHint}
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#fbbf24' }}>
                              {'Alerte'}
                            </label>
                            <input
                              value={v.detail?.raw?.alerte ?? ''}
                              onChange={v.detail?.edit?.alerte}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                fontFamily: "'JetBrains Mono',monospace",
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#fb7185' }}>
                              {'Kill'}
                            </label>
                            <input
                              value={v.detail?.raw?.kill ?? ''}
                              onChange={v.detail?.edit?.kill}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                fontFamily: "'JetBrains Mono',monospace",
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.09em',
                            color: '#52525b',
                            paddingBottom: '6px',
                            borderBottom: '1px solid rgba(39,39,42,0.6)',
                          }}
                        >
                          {'Échéance'}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Date de début'}
                            </label>
                            <input
                              type={'date'}
                              value={v.detail?.startDate ?? ''}
                              onChange={v.detail?.edit?.startAt}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                fontFamily: "'JetBrains Mono',monospace",
                                colorScheme: 'dark',
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Échéance'}
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {(v.detail?.echeanceChips ?? []).map((t: ViewItem, $index: number) => (
                                <Fragment key={listKey(t, $index)}>
                                  <button
                                    onClick={t?.onClick}
                                    style={{
                                      padding: '5px 11px',
                                      borderRadius: '99px',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      color: t?.color,
                                      background: t?.bg,
                                      border: '1px solid ' + (t?.border ?? '') + '',
                                    }}
                                  >
                                    {t?.label}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </div>

                        {v.detail?.isMandat ? (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                flexWrap: 'wrap',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(39,39,42,0.8)',
                                background: 'rgba(24,24,27,0.35)',
                              }}
                            >
                              <span style={{ fontSize: '12.5px', color: '#f4f4f5' }}>
                                {v.detail?.mandatLabel}
                              </span>

                              <span
                                style={{ fontSize: '11px', color: '#71717a', flex: '1', minWidth: '200px' }}
                              >
                                {'au terme : renouveler si la discipline tient, clôturer ou supprimer sinon'}
                              </span>

                              <button
                                onClick={v.detail?.renouvelerMandat}
                                style={{
                                  background: '#09090b',
                                  color: '#f4f4f5',
                                  border: '1px solid #3f3f46',
                                  padding: '7px 12px',
                                  borderRadius: '10px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                                className={'cosmos-hover-49'}
                              >
                                {'Renouveler le mandat · +12 mois'}
                              </button>
                            </div>
                          </>
                        ) : null}

                        {v.detail?.isDatee ? (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1px solid rgba(39,39,42,0.8)',
                                background: 'rgba(24,24,27,0.35)',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                                  {'Date de clôture'}
                                </label>
                                <span
                                  style={{
                                    fontFamily: "'JetBrains Mono',monospace",
                                    fontSize: '11px',
                                    color: '#71717a',
                                  }}
                                >
                                  {'retenu : '}
                                  <span style={{ color: '#f4f4f5' }}>{v.detail?.cloture}</span>
                                </span>
                              </div>

                              <div
                                style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr', gap: '8px' }}
                              >
                                <input
                                  type={'date'}
                                  key={v.detail?.clotureDate}
                                  value={v.detail?.clotureDate ?? ''}
                                  onChange={v.detail?.edit?.cloture}
                                  style={{
                                    minWidth: '0',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    borderRadius: '10px',
                                    padding: '8px 12px',
                                    fontSize: '12.5px',
                                    color: '#f4f4f5',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                  }}
                                />

                                <select
                                  value={v.detail?.clotureSel?.rel ?? ''}
                                  onChange={v.detail?.pickCloture}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: '#f4f4f5',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    minWidth: '0',
                                  }}
                                >
                                  <option value={''}>{'Jours relatifs…'}</option>
                                  {(v.clotureOpts?.rel ?? []).map((o: ViewItem, $index: number) => (
                                    <Fragment key={listKey(o, $index)}>
                                      <option value={o?.value ?? ''}>{o?.label}</option>
                                    </Fragment>
                                  ))}
                                </select>

                                <select
                                  value={v.detail?.clotureSel?.month ?? ''}
                                  onChange={v.detail?.pickCloture}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: '#f4f4f5',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    minWidth: '0',
                                  }}
                                >
                                  <option value={''}>{'Fins de mois…'}</option>
                                  {(v.clotureOpts?.monthGroups ?? []).map((g: ViewItem, $index: number) => (
                                    <Fragment key={listKey(g, $index)}>
                                      <optgroup label={g?.year}>
                                        {(g?.items ?? []).map((o: ViewItem, $index: number) => (
                                          <Fragment key={listKey(o, $index)}>
                                            <option value={o?.value ?? ''}>{o?.label}</option>
                                          </Fragment>
                                        ))}
                                      </optgroup>
                                    </Fragment>
                                  ))}
                                </select>

                                <span></span>

                                <select
                                  value={v.detail?.clotureSel?.quarter ?? ''}
                                  onChange={v.detail?.pickCloture}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: '#f4f4f5',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    minWidth: '0',
                                  }}
                                >
                                  <option value={''}>{'Fins de trimestre…'}</option>
                                  {(v.clotureOpts?.quarters ?? []).map((o: ViewItem, $index: number) => (
                                    <Fragment key={listKey(o, $index)}>
                                      <option value={o?.value ?? ''}>{o?.label}</option>
                                    </Fragment>
                                  ))}
                                </select>

                                <select
                                  value={v.detail?.clotureSel?.year ?? ''}
                                  onChange={v.detail?.pickCloture}
                                  style={{
                                    padding: '8px 10px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: '#f4f4f5',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    fontFamily: "'JetBrains Mono',monospace",
                                    colorScheme: 'dark',
                                    outline: 'none',
                                    minWidth: '0',
                                  }}
                                >
                                  <option value={''}>{"Fins d'année…"}</option>
                                  {(v.clotureOpts?.years ?? []).map((o: ViewItem, $index: number) => (
                                    <Fragment key={listKey(o, $index)}>
                                      <option value={o?.value ?? ''}>{o?.label}</option>
                                    </Fragment>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#fbbf24' }}>
                                {'Préavis de tension '}
                                <span style={{ fontWeight: '400', color: '#52525b' }}>
                                  {'— jours avant clôture'}
                                </span>
                              </label>

                              <div
                                style={{
                                  display: 'flex',
                                  gap: '6px',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <input
                                  type={'number'}
                                  min={'0'}
                                  value={v.detail?.raw?.alertDays ?? ''}
                                  onChange={v.detail?.edit?.alertDays}
                                  style={{
                                    width: '80px',
                                    background: '#09090b',
                                    border: '1px solid #27272a',
                                    borderRadius: '10px',
                                    padding: '8px 12px',
                                    fontSize: '12.5px',
                                    color: '#f4f4f5',
                                    fontFamily: "'JetBrains Mono',monospace",
                                  }}
                                />
                                {(v.detail?.alertChips ?? []).map((c: ViewItem, $index: number) => (
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
                                        fontFamily: "'JetBrains Mono',monospace",
                                      }}
                                    >
                                      {c?.label}
                                    </button>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {v.detail?.notEditing ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div
                      style={{
                        fontSize: '10.5px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        color: '#52525b',
                      }}
                    >
                      {'Seuils de protection'}
                    </div>

                    {v.detail?.notEditing ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div
                            style={{
                              background: '#09090b',
                              border: '1px solid rgba(39,39,42,0.8)',
                              borderRadius: '12px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.09em',
                                color: '#fbbf24',
                              }}
                            >
                              {'Alerte'}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono',monospace",
                                fontSize: '12px',
                                color: '#f4f4f5',
                              }}
                            >
                              {v.detail?.alerte}
                            </span>
                            <span style={{ fontSize: '11px', color: '#52525b' }}>
                              {'seuil de correction'}
                            </span>
                          </div>

                          <div
                            style={{
                              background: '#09090b',
                              border: '1px solid rgba(39,39,42,0.8)',
                              borderRadius: '12px',
                              padding: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.09em',
                                color: '#fb7185',
                              }}
                            >
                              {'Kill'}
                            </span>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono',monospace",
                                fontSize: '12px',
                                color: '#f4f4f5',
                              }}
                            >
                              {v.detail?.kill}
                            </span>
                            <span style={{ fontSize: '11px', color: '#52525b' }}>
                              {'seuil de non-retour'}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#52525b',
                  }}
                >
                  <span>{'Étapes'}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
                    {'' + (v.detail?.doneCount ?? '') + ' / ' + (v.detail?.actionCount ?? '') + ' faites'}
                  </span>
                </div>

                <div style={{ fontSize: '11.5px', color: '#52525b' }}>
                  {"liste de tâches — le SAS, s'il existe, est la porte d'entrée"}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {v.detail?.hasSas ? (
                    <>
                      <div
                        onClick={v.detail?.toggleSas}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          borderRadius: '10px',
                          border: '1px solid rgba(129,140,248,0.45)',
                          background: 'rgba(99,102,241,0.08)',
                          cursor: 'pointer',
                          fontSize: '12.5px',
                          color: v.detail?.sasColor,
                          textDecoration: v.detail?.sasDeco,
                        }}
                        className={'cosmos-hover-50'}
                      >
                        <span
                          style={{
                            width: '16px',
                            height: '16px',
                            flex: 'none',
                            borderRadius: '5px',
                            border: '1px solid ' + (v.detail?.sasBoxBorder ?? '') + '',
                            background: v.detail?.sasBoxBg,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10px',
                            color: '#09090b',
                            fontWeight: '700',
                          }}
                        >
                          {v.detail?.sasMark}
                        </span>

                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '10.5px',
                            fontWeight: '700',
                            color: '#818cf8',
                            letterSpacing: '0.06em',
                            flex: 'none',
                          }}
                        >
                          {'SAS'}
                        </span>
                        {v.detail?.raw?.sas}
                        {v.detail?.projIsSas ? (
                          <>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono',monospace",
                                fontSize: '10.5px',
                                color: v.detail?.projColor,
                                marginLeft: 'auto',
                                paddingLeft: '10px',
                                whiteSpace: 'nowrap',
                                textDecoration: 'none',
                              }}
                            >
                              {"jusqu'au " +
                                (v.detail?.sasUntilLabel ?? '') +
                                ' · ' +
                                (v.detail?.projLabel ?? '') +
                                ''}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {v.detail?.notEditing ? (
                    <>
                      {(v.detail?.actions ?? []).map((a: ViewItem, $index: number) => (
                        <Fragment key={listKey(a, $index)}>
                          <div
                            onClick={a?.toggle}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '9px 12px',
                              borderRadius: '10px',
                              border: '1px solid rgba(39,39,42,0.8)',
                              background: '#09090b',
                              cursor: 'pointer',
                              fontSize: '12.5px',
                              color: a?.color,
                              textDecoration: a?.deco,
                            }}
                            className={'cosmos-hover-51'}
                          >
                            <span
                              style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '5px',
                                border: '1px solid ' + (a?.boxBorder ?? '') + '',
                                background: a?.boxBg,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                color: '#09090b',
                                fontWeight: '700',
                              }}
                            >
                              {a?.mark}
                            </span>
                            {a?.text}
                          </div>
                        </Fragment>
                      ))}
                    </>
                  ) : null}

                  {v.detail?.editing ? (
                    <>
                      {(v.detail?.actions ?? []).map((a: ViewItem, $index: number) => (
                        <Fragment key={listKey(a, $index)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              onClick={a?.toggle}
                              style={{
                                width: '16px',
                                height: '16px',
                                flex: 'none',
                                borderRadius: '5px',
                                border: '1px solid ' + (a?.boxBorder ?? '') + '',
                                background: a?.boxBg,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                color: '#09090b',
                                fontWeight: '700',
                                cursor: 'pointer',
                              }}
                            >
                              {a?.mark}
                            </span>

                            <input
                              value={a?.text ?? ''}
                              onChange={a?.onText}
                              placeholder={'nouvelle étape'}
                              style={{
                                flex: '1',
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '8px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                              }}
                            />

                            <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button
                                onClick={a?.up}
                                title={'Monter'}
                                style={{
                                  width: '22px',
                                  height: '14px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: a?.upColor,
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                  lineHeight: '1',
                                  padding: '0',
                                }}
                              >
                                {'▲'}
                              </button>
                              <button
                                onClick={a?.down}
                                title={'Descendre'}
                                style={{
                                  width: '22px',
                                  height: '14px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: a?.downColor,
                                  cursor: 'pointer',
                                  fontSize: '10px',
                                  lineHeight: '1',
                                  padding: '0',
                                }}
                              >
                                {'▼'}
                              </button>
                            </span>

                            <button
                              onClick={a?.remove}
                              title={"Supprimer l'étape"}
                              style={{
                                width: '28px',
                                height: '28px',
                                flex: 'none',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'rgba(244,63,94,0.1)',
                                color: '#fb7185',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                              className={'cosmos-hover-52'}
                            >
                              {'✕'}
                            </button>
                          </div>
                        </Fragment>
                      ))}

                      <button
                        onClick={v.detail?.addStep}
                        style={{
                          background: '#09090b',
                          color: '#a1a1aa',
                          border: '1px dashed #27272a',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                        className={'cosmos-hover-53'}
                      >
                        {'+ Ajouter une étape'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10.5px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#52525b',
                  }}
                >
                  <span>{'Statut'}</span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '0',
                      textTransform: 'none',
                      color: v.detail?.statutColor,
                      background: v.detail?.statutBg,
                    }}
                  >
                    {v.detail?.statut}
                  </span>
                </div>

                <div style={{ fontSize: '11.5px', color: '#52525b' }}>{v.detail?.statutHint}</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {v.detail?.canPause ? (
                    <>
                      {v.detail?.isMandat ? (
                        <>
                          <button
                            onClick={v.detail?.renouvelerMandat}
                            title={v.detail?.mandatLabel}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '99px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              color: '#f4f4f5',
                              background: 'rgba(63,63,70,0.55)',
                              border: '1px solid transparent',
                            }}
                            className={'cosmos-hover-54'}
                          >
                            {'Renouveler le mandat'}
                          </button>
                        </>
                      ) : null}

                      <button
                        onClick={v.detail?.togglePause}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '99px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          color: v.detail?.pauseColor,
                          background: v.detail?.pauseBg,
                          border: '1px solid transparent',
                        }}
                      >
                        {v.detail?.pauseLabel}
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={v.detail?.toggleClose}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '99px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      color: '#a1a1aa',
                      background: '#09090b',
                      border: '1px solid #27272a',
                    }}
                    className={'cosmos-hover-55'}
                  >
                    {v.detail?.closeLabel}
                  </button>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '14px 20px',
                borderTop: '1px solid rgba(39,39,42,0.8)',
              }}
            >
              {v.confirmDeleteMini ? (
                <>
                  <div
                    style={{
                      flex: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: 'rgba(244,63,94,0.1)',
                      fontSize: '12px',
                      color: '#fb7185',
                    }}
                  >
                    <span>{'Supprimer définitivement ce mini-cosmos ?'}</span>

                    <span style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={v.cancelDeleteMini}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#a1a1aa',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        {'Annuler'}
                      </button>
                      <button
                        onClick={v.doDeleteMini}
                        style={{
                          background: '#fb7185',
                          border: 'none',
                          color: '#09090b',
                          fontWeight: '600',
                          fontSize: '12px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        {'Supprimer'}
                      </button>
                    </span>
                  </div>
                </>
              ) : null}

              {v.footerIdle ? (
                <>
                  <span></span>

                  <button
                    onClick={v.closeDetail}
                    style={{
                      background: '#fafafa',
                      color: '#09090b',
                      border: 'none',
                      padding: '8px 15px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                    className={'cosmos-hover-56'}
                  >
                    {'Fermer'}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
