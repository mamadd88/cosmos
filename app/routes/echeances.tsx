import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function EcheancesPage() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.isEcheances ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 24px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '22px',
                padding: '10px 20px',
                borderRadius: '14px',
                border: '1px solid rgba(39,39,42,0.8)',
                background: 'rgba(24,24,27,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {(v.echKpis ?? []).map((k: ViewItem, $index: number) => (
                <Fragment key={listKey(k, $index)}>
                  <div
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
                        color: k?.color,
                      }}
                    >
                      {k?.value}
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
                      {k?.label}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '20px 16px 0',
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            {(v.echZoneChips ?? []).map((c: ViewItem, $index: number) => (
              <Fragment key={listKey(c, $index)}>
                <button
                  onClick={c?.onClick}
                  title={'Zone de projection'}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '99px',
                    fontSize: '12px',
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
                    style={{ width: c?.dotW, height: '6px', borderRadius: '99px', background: c?.dot }}
                  ></span>
                  {c?.label}
                  <span
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#fafafa' }}
                  >
                    {c?.count}
                  </span>
                  <span
                    style={{
                      width: c?.vitalW,
                      height: '6px',
                      borderRadius: '99px',
                      background: '#fafafa',
                      boxShadow: '0 0 5px rgba(250,250,250,0.6)',
                    }}
                  ></span>
                </button>
              </Fragment>
            ))}

            <span
              style={{ width: '1px', height: '18px', background: 'rgba(39,39,42,0.8)', margin: '0 8px' }}
            ></span>

            {(v.echTimeChips ?? []).map((c: ViewItem, $index: number) => (
              <Fragment key={listKey(c, $index)}>
                <button
                  onClick={c?.onClick}
                  title={c?.title}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: c?.color,
                    background: c?.bg,
                    border: '1px solid ' + (c?.border ?? '') + '',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    fontFamily: "'JetBrains Mono',monospace",
                  }}
                >
                  {c?.label}
                  <span style={{ fontSize: '11px', color: '#fafafa' }}>{c?.count}</span>
                </button>
              </Fragment>
            ))}

            <select
              value={v.quarterFilter ?? ''}
              onChange={v.setQuarter}
              title={"Trimestre de l'échéance"}
              style={{
                width: v.quarterW,
                padding: '5px 10px',
                borderRadius: '99px',
                fontSize: '12px',
                cursor: 'pointer',
                color: v.quarterStyle?.color,
                background: v.quarterStyle?.bg,
                border: '1px solid ' + (v.quarterStyle?.border ?? '') + '',
                fontFamily: "'JetBrains Mono',monospace",
                colorScheme: 'dark',
                outline: 'none',
              }}
            >
              <option value={''}>{'Trimestre'}</option>

              {(v.quarterGroups ?? []).map((g: ViewItem, $index: number) => (
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

            <select
              value={v.monthFilter ?? ''}
              onChange={v.setMonth}
              title={"Mois de l'échéance"}
              style={{
                width: v.monthW,
                padding: '5px 10px',
                borderRadius: '99px',
                fontSize: '12px',
                cursor: 'pointer',
                color: v.monthStyle?.color,
                background: v.monthStyle?.bg,
                border: '1px solid ' + (v.monthStyle?.border ?? '') + '',
                fontFamily: "'JetBrains Mono',monospace",
                colorScheme: 'dark',
                outline: 'none',
              }}
            >
              <option value={''}>{'Mois'}</option>

              {(v.monthGroups ?? []).map((g: ViewItem, $index: number) => (
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

            <select
              value={v.yearFilter ?? ''}
              onChange={v.setYear}
              title={"Année de l'échéance"}
              style={{
                width: v.yearW,
                padding: '5px 10px',
                borderRadius: '99px',
                fontSize: '12px',
                cursor: 'pointer',
                color: v.yearStyle?.color,
                background: v.yearStyle?.bg,
                border: '1px solid ' + (v.yearStyle?.border ?? '') + '',
                fontFamily: "'JetBrains Mono',monospace",
                colorScheme: 'dark',
                outline: 'none',
              }}
            >
              {(v.yearOptions ?? []).map((o: ViewItem, $index: number) => (
                <Fragment key={listKey(o, $index)}>
                  <option value={o?.value ?? ''}>{o?.label}</option>
                </Fragment>
              ))}
            </select>

            {v.echHasFilters ? (
              <>
                <button
                  onClick={v.resetEcheancesFilters}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '99px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#a1a1aa',
                    background: '#09090b',
                    border: '1px solid #27272a',
                  }}
                >
                  {'Réinitialiser les filtres'}
                </button>
              </>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 16px 0',
              width: '100%',
            }}
          >
            <input
              value={v.eQuery ?? ''}
              onChange={v.setEQuery}
              placeholder={'Rechercher un mini-cosmos, un cosmos, une valeur…'}
              style={{
                width: '420px',
                background: '#09090b',
                border: '1px solid #27272a',
                borderRadius: '10px',
                padding: '9px 12px',
                fontSize: '12.5px',
                color: '#f4f4f5',
              }}
            />
          </div>

          <div style={{ padding: '24px 16px 32px', width: 'min(100%,1180px)', margin: '0 auto' }}>
            <div
              style={{
                background: 'rgba(24,24,27,0.5)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(39,39,42,0.8)',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(24,24,27,0.75)',
                  borderBottom: '1px solid rgba(39,39,42,0.8)',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#fafafa',
                  }}
                >
                  {'Échéances · de la plus proche à la plus lointaine'}
                </span>
                <span
                  style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#71717a' }}
                >
                  {'' + (v.echShown ?? '') + ' sur ' + (v.echCount ?? '') + ' datées'}
                </span>
              </div>

              {v.noEcheances ? (
                <>
                  <div style={{ padding: '16px', fontSize: '12px', color: '#52525b' }}>{v.echEmptyLabel}</div>
                </>
              ) : null}

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '900px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(150px,1.3fr) minmax(110px,150px) 64px minmax(120px,1fr) minmax(120px,150px) 140px 56px',
                      gap: '0 14px',
                      padding: '9px 16px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#52525b',
                      borderBottom: '1px solid rgba(39,39,42,0.35)',
                    }}
                  >
                    <span>{'Mini-cosmos'}</span>
                    <span>{'Cosmos'}</span>
                    <span>{'Statut'}</span>
                    <span>{'Valeur actuelle'}</span>
                    <span>{'Échéance'}</span>
                    <span>{'Projection'}</span>
                    <span style={{ textAlign: 'right' }}>{'Jours'}</span>
                  </div>

                  {(v.echeances ?? []).map((x: ViewItem, $index: number) => (
                    <Fragment key={listKey(x, $index)}>
                      <button
                        type={'button'}
                        key={x?.id}
                        onClick={x?.open}
                        aria-label={x?.openLabel}
                        title={x?.openLabel}
                        style={{
                          display: 'grid',
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          color: 'inherit',
                          border: '0',
                          borderRadius: '0',
                          gridTemplateColumns:
                            'minmax(150px,1.3fr) minmax(110px,150px) 64px minmax(120px,1fr) minmax(120px,150px) 140px 56px',
                          gap: '0 14px',
                          alignItems: 'center',
                          padding: '9px 16px',
                          borderBottom: '1px solid rgba(39,39,42,0.35)',
                          cursor: 'pointer',
                        }}
                        className={'echeance-row cosmos-hover-14'}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            color: '#fafafa',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '99px',
                              flex: 'none',
                              background: x?.poidsBg,
                              border: '1.5px solid ' + (x?.poidsBorder ?? '') + '',
                            }}
                          ></span>
                          {x?.name}
                        </span>

                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '10.5px',
                            color: '#fafafa',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span
                            style={{
                              width: '3px',
                              height: '12px',
                              borderRadius: '2px',
                              background: x?.cosmosColor,
                              flex: 'none',
                            }}
                          ></span>
                          {x?.cosmos}
                        </span>

                        <span>
                          <span
                            title={x?.statutHint}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '99px',
                              fontSize: '10.5px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                              color: x?.statutColor,
                              background: x?.statutBg,
                            }}
                          >
                            {x?.statut}
                          </span>
                        </span>

                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11.5px',
                            color: '#d4d4d8',
                          }}
                        >
                          {x?.actuel}
                        </span>

                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11px',
                            color: x?.statutColor,
                          }}
                        >
                          {x?.isSas ? (
                            <>
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: '#818cf8',
                                  background: 'rgba(99,102,241,0.12)',
                                  padding: '1px 5px',
                                  borderRadius: '5px',
                                  flex: 'none',
                                }}
                              >
                                {'SAS'}
                              </span>
                            </>
                          ) : null}
                          {x?.cloture}
                        </span>

                        <span
                          style={{
                            height: '4px',
                            borderRadius: '2px',
                            background: '#27272a',
                            overflow: 'hidden',
                          }}
                        >
                          <span
                            style={{ display: 'block', height: '100%', background: x?.color, width: x?.pct }}
                          ></span>
                        </span>

                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11px',
                            fontWeight: '600',
                            color: x?.color,
                            textAlign: 'right',
                          }}
                        >
                          {x?.label}
                        </span>
                      </button>
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
