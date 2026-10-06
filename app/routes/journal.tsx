import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function JournalPage() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.isJournal ? (
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
              {(v.jActivity ?? []).map((m: ViewItem, $index: number) => (
                <Fragment key={listKey(m, $index)}>
                  <div
                    title={m?.title}
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
                        color: m?.color,
                      }}
                    >
                      {m?.value}
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
                      {m?.label}
                    </span>
                  </div>
                </Fragment>
              ))}

              <div
                title={'étapes cochées par semaine · ' + (v.jPeriodLabel ?? '') + ''}
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
                    color: '#34d399',
                  }}
                >
                  {v.jStepsPerWeek}
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
                  {'étapes / sem.'}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '20px 24px 0',
              flexWrap: 'wrap',
              width: 'min(100%,1100px)',
              margin: '0 auto',
            }}
          >
            {(v.jTypeChips ?? []).map((c: ViewItem, $index: number) => (
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
                </button>
              </Fragment>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 24px 0',
              flexWrap: 'wrap',
              width: 'min(100%,1100px)',
              margin: '0 auto',
            }}
          >
            {(v.jPeriodChips ?? []).map((c: ViewItem, $index: number) => (
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

            <span
              style={{ width: '1px', height: '18px', background: 'rgba(39,39,42,0.8)', margin: '0 8px' }}
            ></span>

            {(v.jAuthorChips ?? []).map((c: ViewItem, $index: number) => (
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
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                  }}
                >
                  {c?.label}
                  <span
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#fafafa' }}
                  >
                    {c?.count}
                  </span>
                </button>
              </Fragment>
            ))}

            {v.jHasFilters ? (
              <>
                <button
                  type={'button'}
                  onClick={v.resetJournalFilters}
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
              padding: '14px 24px 0',
              width: 'min(100%,1100px)',
              margin: '0 auto',
            }}
          >
            <input
              value={v.jQuery ?? ''}
              onChange={v.setJQuery}
              placeholder={'Rechercher un mini-cosmos, un cosmos, un détail…'}
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

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              padding: '24px 24px 32px',
              width: 'min(100%,1100px)',
              margin: '0 auto',
            }}
          >
            {v.jEmpty ? (
              <>
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    fontSize: '12.5px',
                    color: '#52525b',
                    border: '1px dashed rgba(39,39,42,0.8)',
                    borderRadius: '16px',
                  }}
                >
                  {'aucune entrée'}
                </div>
              </>
            ) : null}

            {(v.jGroups ?? []).map((g: ViewItem, $index: number) => (
              <Fragment key={listKey(g, $index)}>
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
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
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
                      {g?.label}
                    </span>
                    <span
                      style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#71717a' }}
                    >
                      {g?.count}
                    </span>
                  </div>

                  {(g?.items ?? []).map((e: ViewItem, $index: number) => (
                    <Fragment key={listKey(e, $index)}>
                      <div
                        key={e?.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '48px 96px 120px 1fr 90px',
                          gap: '14px',
                          alignItems: 'center',
                          padding: '10px 16px',
                          borderBottom: '1px solid rgba(39,39,42,0.35)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11px',
                            color: '#71717a',
                          }}
                        >
                          {e?.time}
                        </span>

                        <span>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '99px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: e?.typeColor,
                              background: 'rgba(39,39,42,0.55)',
                            }}
                          >
                            {e?.typeLabel}
                          </span>
                        </span>

                        <button
                          type={'button'}
                          className={'journal-mini'}
                          onClick={e?.openMini}
                          disabled={e?.unlinked}
                          aria-label={e?.openLabel}
                          title={e?.miniHint}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            minWidth: '0',
                            padding: '0',
                            border: '0',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: e?.miniCursor,
                          }}
                        >
                          <span
                            className={'journal-mini-name'}
                            style={{
                              maxWidth: '100%',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              color: e?.miniColor,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {e?.mini}
                          </span>
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono',monospace",
                              fontSize: '10px',
                              color: '#52525b',
                              textTransform: 'uppercase',
                            }}
                          >
                            {e?.cosmos}
                          </span>
                        </button>

                        <div
                          style={{
                            fontSize: '12.5px',
                            color: '#d4d4d8',
                            minWidth: '0',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          <span>{e?.detail}</span>

                          {e?.hasChanges ? (
                            <>
                              <details className={'journal-changes'} key={e?.id} style={{ marginTop: '6px' }}>
                                <summary style={{ cursor: 'pointer', color: '#a1a1aa', fontSize: '11.5px' }}>
                                  {'Voir les valeurs avant / après'}
                                </summary>

                                {(e?.changeLines ?? []).map((c: ViewItem, $index: number) => (
                                  <Fragment key={listKey(c, $index)}>
                                    <div
                                      style={{
                                        marginTop: '8px',
                                        padding: '8px 10px',
                                        borderLeft: '2px solid #3f3f46',
                                        background: 'rgba(9,9,11,0.4)',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      <div
                                        style={{ fontWeight: '600', color: '#f4f4f5', marginBottom: '4px' }}
                                      >
                                        {c?.field}
                                      </div>

                                      <div style={{ whiteSpace: 'pre-wrap' }}>
                                        <span style={{ color: '#71717a' }}>{'Avant : '}</span>
                                        {c?.before}
                                      </div>

                                      <div style={{ whiteSpace: 'pre-wrap' }}>
                                        <span style={{ color: '#71717a' }}>{'Après : '}</span>
                                        {c?.after}
                                      </div>
                                    </div>
                                  </Fragment>
                                ))}
                              </details>
                            </>
                          ) : null}
                        </div>

                        <span
                          style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: '11px',
                            color: e?.authorColor,
                            textAlign: 'right',
                          }}
                        >
                          {e?.author}
                        </span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            ))}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 4px',
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: '11px',
                color: '#71717a',
              }}
            >
              <span>
                {'' + (v.jRange ?? '') + ' sur ' + (v.jShown ?? '') + ' entrées'}
                <span style={{ color: '#3f3f46' }}>{' · ' + (v.jTotal ?? '') + ' sur 12 mois'}</span>
                {v.jHasArchive ? (
                  <>
                    <span style={{ color: '#3f3f46' }}>
                      {' · ' + (v.jArchived ?? '') + " archivées (dans l'export JSON)"}
                    </span>
                  </>
                ) : null}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type={'button'}
                  onClick={v.jFirst}
                  disabled={v.jPrevDisabled}
                  aria-label={'Première page'}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: v.jPrevColor,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {'«'}
                </button>

                <button
                  type={'button'}
                  onClick={v.jPrev}
                  disabled={v.jPrevDisabled}
                  aria-label={'Page précédente'}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: v.jPrevColor,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {'‹'}
                </button>

                <span style={{ padding: '0 10px', color: '#a1a1aa' }}>{v.jPageLabel}</span>

                <button
                  type={'button'}
                  onClick={v.jNext}
                  disabled={v.jNextDisabled}
                  aria-label={'Page suivante'}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: v.jNextColor,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {'›'}
                </button>

                <button
                  type={'button'}
                  onClick={v.jLast}
                  disabled={v.jNextDisabled}
                  aria-label={'Dernière page'}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: v.jNextColor,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {'»'}
                </button>
              </span>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
