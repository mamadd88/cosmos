import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function ModelesPage() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.isTemplates ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              padding: '20px 24px 0',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.01em', color: '#fafafa' }}
              >
                {'Modèles de mini-cosmos'}
              </div>

              <div style={{ fontSize: '11.5px', color: '#71717a' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{v.tplTotal}</span>
                {' terrains prêts à gouverner — cliquer un modèle ouvre le formulaire pré-rempli'}
              </div>
            </div>

            <input
              value={v.tplQuery ?? ''}
              onChange={v.setTplQuery}
              placeholder={'Rechercher un modèle…'}
              style={{
                width: '280px',
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
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(400px,1fr))',
              gap: '14px',
              padding: '16px 24px 32px',
              alignItems: 'start',
            }}
          >
            {(v.tplGroups ?? []).map((g: ViewItem, $index: number) => (
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
                      gap: '12px',
                      padding: '12px 16px',
                      background: 'rgba(24,24,27,0.75)',
                      borderBottom: '1px solid rgba(39,39,42,0.8)',
                    }}
                  >
                    <span
                      style={{ width: '3px', height: '16px', borderRadius: '2px', background: g?.color }}
                    ></span>

                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#fafafa',
                      }}
                    >
                      {g?.domain}
                    </span>

                    <span
                      style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: '#71717a' }}
                    >
                      {'' + (g?.count ?? '') + ' modèles'}
                    </span>

                    <span style={{ flex: '1' }}></span>

                    {g?.exists ? (
                      <>
                        <span
                          style={{
                            padding: '3px 9px',
                            borderRadius: '99px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#34d399',
                            background: 'rgba(16,185,129,0.1)',
                          }}
                        >
                          {'Cosmos existant'}
                        </span>
                      </>
                    ) : null}

                    {g?.missing ? (
                      <>
                        <button
                          onClick={g?.createCosmos}
                          style={{
                            background: '#09090b',
                            color: '#a1a1aa',
                            border: '1px solid #27272a',
                            padding: '5px 11px',
                            borderRadius: '99px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                          className={'cosmos-hover-15'}
                        >
                          {'+ Créer ce cosmos'}
                        </button>
                      </>
                    ) : null}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '14px 16px' }}>
                    {(g?.items ?? []).map((t: ViewItem, $index: number) => (
                      <Fragment key={listKey(t, $index)}>
                        <button
                          onClick={t?.use}
                          style={{
                            padding: '5px 11px',
                            borderRadius: '99px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: '#a1a1aa',
                            background: '#09090b',
                            border: '1px solid #27272a',
                          }}
                          className={'cosmos-hover-16'}
                        >
                          {t?.label}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
