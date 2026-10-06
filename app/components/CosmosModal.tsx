import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function CosmosModal() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.showCosmosModal ? (
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
                width: '560px',
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
                    {'Nouveau cosmos'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#71717a' }}>
                    {'un grand domaine de ta vie que tu décides de structurer et de protéger'}
                  </div>
                </div>

                <button
                  onClick={v.closeModals}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    border: '1px solid #27272a',
                    background: '#09090b',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                  }}
                  className={'cosmos-hover-61'}
                >
                  {'✕'}
                </button>
              </div>

              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    style={{
                      fontSize: '11.5px',
                      fontWeight: '600',
                      color: '#a1a1aa',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>{'01'}</span>
                    {'Nom du cosmos '}
                    <span style={{ color: '#fb7185' }}>{'*'}</span>
                  </label>

                  <input
                    value={v.cosmosName ?? ''}
                    onChange={v.setCosmosName}
                    onKeyDown={v.cosmosKey}
                    autoFocus={true}
                    placeholder={'ENTREPRISE, FAMILLE, RELATIONS…'}
                    style={{
                      background: '#09090b',
                      border: '1px solid #27272a',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      color: '#f4f4f5',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  />

                  {v.cosmosDup ? (
                    <>
                      <div style={{ fontSize: '11.5px', color: '#fb7185' }}>{'ce cosmos existe déjà'}</div>
                    </>
                  ) : null}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label
                    style={{
                      fontSize: '11.5px',
                      fontWeight: '600',
                      color: '#a1a1aa',
                      display: 'flex',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>{'02'}</span>
                    {'Étage'}
                  </label>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(v.etageChips ?? []).map((c: ViewItem, $index: number) => (
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

                  <div style={{ fontSize: '11px', color: '#71717a' }}>{v.etageHint}</div>
                </div>

                <div
                  style={{
                    background: '#0c0c0e',
                    border: '1px solid rgba(39,39,42,0.8)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: '11px',
                    color: '#71717a',
                    lineHeight: '1.6',
                  }}
                >
                  {'Un cosmos est une pièce. Un mini-cosmos est un meuble.'}
                  <br />
                  {'Tu pourras y ajouter des mini-cosmos depuis le tableau ou les modèles.'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  padding: '14px 22px',
                  borderTop: '1px solid rgba(39,39,42,0.8)',
                }}
              >
                <button
                  onClick={v.closeModals}
                  style={{
                    background: '#09090b',
                    color: '#a1a1aa',
                    border: '1px solid #27272a',
                    padding: '8px 13px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                  className={'cosmos-hover-62'}
                >
                  {'Annuler'}
                </button>

                <button
                  onClick={v.saveCosmos}
                  disabled={v.cosmosInvalid}
                  style={{
                    background: '#fafafa',
                    color: '#09090b',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    opacity: v.cosmosBtnOpacity,
                  }}
                  className={'cosmos-hover-63'}
                >
                  {'Créer le cosmos'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
