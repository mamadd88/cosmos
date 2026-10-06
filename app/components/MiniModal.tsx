import { Fragment } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { listKey, type ViewItem } from '../state/view-items';

export default function MiniModal() {
  const { values: v } = useCosmos();
  return (
    <>
      {v.showMiniModal ? (
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
                width: '820px',
                maxHeight: '88vh',
                background: '#0c0c0e',
                border: '1px solid rgba(39,39,42,0.9)',
                borderRadius: '22px',
                animation: 'popin 180ms ease',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', padding: '20px 22px 0', gap: '12px' }}>
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      fontSize: '17px',
                      fontWeight: '700',
                      color: '#fafafa',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {'Nouveau mini-cosmos'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#71717a' }}>
                    {"un terrain précis que tu gouvernes à l'intérieur d'un cosmos"}
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
                  className={'cosmos-hover-64'}
                >
                  {'✕'}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '14px 22px 0',
                  borderBottom: '1px solid rgba(39,39,42,0.8)',
                }}
              >
                {(v.tabs ?? []).map((t: ViewItem, $index: number) => (
                  <Fragment key={listKey(t, $index)}>
                    <button
                      onClick={t?.onClick}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '2px solid ' + (t?.line ?? '') + '',
                        padding: '8px 2px 10px',
                        fontSize: '12.5px',
                        fontWeight: '500',
                        color: t?.color,
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono',monospace",
                          fontSize: '11px',
                          color: '#52525b',
                        }}
                      >
                        {t?.num}
                      </span>
                      {t?.label}
                    </button>
                  </Fragment>
                ))}
              </div>

              <div
                style={{
                  flex: '1',
                  overflowY: 'auto',
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {v.tab0 ? (
                  <>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'01'}
                        </span>
                        {'Cosmos parent '}
                        <span style={{ color: '#fb7185' }}>{'*'}</span>
                      </label>

                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(v.parentChips ?? []).map((p: ViewItem, $index: number) => (
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

                      {v.formHasTitres ? (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#a1a1aa' }}>
                              {'Titre '}
                              <span style={{ fontWeight: '400', color: '#52525b' }}>
                                {'la séparation sous laquelle ranger ce terrain'}
                              </span>
                            </label>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {(v.formTitreChips ?? []).map((c: ViewItem, $index: number) => (
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'02'}
                        </span>
                        {'Nom du mini-cosmos '}
                        <span style={{ color: '#fb7185' }}>{'*'}</span>
                      </label>

                      <input
                        value={v.form?.name ?? ''}
                        onChange={v.set?.name}
                        placeholder={'Projet A, Maison, Lecture…'}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                        }}
                      />

                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          paddingTop: '2px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#52525b', marginRight: '2px' }}>
                          {'poids'}
                        </span>

                        {(v.formPoidsChips ?? []).map((c: ViewItem, $index: number) => (
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

                        <span style={{ fontSize: '11px', color: '#52525b' }}>{v.formPoidsHint}</span>
                      </div>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'03'}
                        </span>
                        {'Objectif'}
                      </label>

                      <textarea
                        value={v.form?.objectif ?? ''}
                        onChange={v.set?.objectif}
                        rows={2}
                        placeholder={"Quel est l'état à atteindre ou maintenir ?"}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                      ></textarea>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'04'}
                        </span>
                        {'Valeur actuelle'}
                      </label>

                      <textarea
                        value={v.form?.actuel ?? ''}
                        onChange={v.set?.actuel}
                        rows={2}
                        placeholder={"Où en es-tu aujourd'hui ?"}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                      ></textarea>
                    </div>
                  </>
                ) : null}

                {v.tab1 ? (
                  <>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'05'}
                        </span>
                        {'Entropie '}
                        <span style={{ color: '#fb7185' }}>{'*'}</span>
                      </label>

                      <textarea
                        value={v.form?.entropie ?? ''}
                        onChange={v.set?.entropie}
                        rows={2}
                        placeholder={'Quels sont les dangers qui guettent ce mini-cosmos ?'}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                      ></textarea>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'06'}
                        </span>
                        {'Réponse entropie '}
                        <span style={{ color: '#fb7185' }}>{'*'}</span>
                      </label>

                      <textarea
                        value={v.form?.reponse ?? ''}
                        onChange={v.set?.reponse}
                        rows={2}
                        placeholder={'Quelle est la parade à ce danger ?'}
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                      ></textarea>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label
                          style={{
                            fontSize: '11.5px',
                            fontWeight: '600',
                            color: '#fbbf24',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                            {'07'}
                          </span>
                          {'Alerte'}
                        </label>

                        <input
                          value={v.form?.alerte ?? ''}
                          onChange={v.set?.alerte}
                          placeholder={'Seuil de correction (avant le Kill)'}
                          style={{
                            background: '#09090b',
                            border: '1px solid #27272a',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            fontSize: '13px',
                            color: '#f4f4f5',
                            fontFamily: "'JetBrains Mono',monospace",
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label
                          style={{
                            fontSize: '11.5px',
                            fontWeight: '600',
                            color: '#fb7185',
                            display: 'flex',
                            gap: '8px',
                          }}
                        >
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                            {'08'}
                          </span>
                          {'Kill'}
                        </label>

                        <input
                          value={v.form?.kill ?? ''}
                          onChange={v.set?.kill}
                          placeholder={'Seuil de non-retour'}
                          style={{
                            background: '#09090b',
                            border: '1px solid #27272a',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            fontSize: '13px',
                            color: '#f4f4f5',
                            fontFamily: "'JetBrains Mono',monospace",
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}

                {v.tab2 ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label
                        style={{
                          fontSize: '11.5px',
                          fontWeight: '600',
                          color: '#818cf8',
                          display: 'flex',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'09'}
                        </span>
                        {'SAS — test avant admission'}
                      </label>

                      <div
                        style={{
                          background: '#0c0c0e',
                          border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: '12px',
                          padding: '12px 14px',
                          fontSize: '11.5px',
                          color: '#a1a1aa',
                          lineHeight: '1.65',
                        }}
                      >
                        {
                          " Le SAS est la zone entre « dehors » et « intégré au cosmos ». Tu ne sais pas encore si ce terrain mérite d'entrer : tu le testes avec une "
                        }
                        <span style={{ color: '#f4f4f5' }}>{'exposition bornée'}</span>
                        {
                          ' — petite exposition → observation → feedback → admission ou suppression. 100 €, pas toute la trésorerie ; 14 jours, pas trois mois.'
                        }
                        <br />

                        <span style={{ color: '#71717a' }}>
                          {"Tant que le SAS n'est pas franchi, le mini-cosmos reste en statut "}
                          <span style={{ color: '#818cf8', fontWeight: '600' }}>{'SAS'}</span>
                          {' et le test devient sa première étape. Laisse vide pour entrer directement en '}
                          <span style={{ color: '#34d399', fontWeight: '600' }}>{'Actif'}</span>
                          {'.'}
                        </span>
                      </div>

                      <textarea
                        value={v.form?.sas ?? ''}
                        onChange={v.set?.sas}
                        rows={2}
                        placeholder={
                          "ex. 14 jours à 100 €/j avec CPA < 14 € · 3 séances d'essai · 30 jours de pratique"
                        }
                        style={{
                          background: '#09090b',
                          border: '1px solid #27272a',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          fontSize: '13px',
                          color: '#f4f4f5',
                          resize: 'vertical',
                          lineHeight: '1.6',
                        }}
                      ></textarea>

                      {v.formHasSas ? (
                        <>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              padding: '10px 12px',
                              borderRadius: '10px',
                              border: '1px solid rgba(99,102,241,0.3)',
                              background: 'rgba(99,102,241,0.06)',
                            }}
                          >
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}
                            >
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  color: '#818cf8',
                                  marginRight: '4px',
                                }}
                              >
                                {'Fin du test'}
                              </span>

                              {(v.formSasChips ?? []).map((c: ViewItem, $index: number) => (
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
                                    }}
                                  >
                                    {c?.label}
                                  </button>
                                </Fragment>
                              ))}

                              <input
                                type={'date'}
                                value={v.formSasUntil ?? ''}
                                onChange={v.setFormSasUntil}
                                style={{
                                  background: '#09090b',
                                  border: '1px solid #27272a',
                                  borderRadius: '8px',
                                  padding: '5px 8px',
                                  fontSize: '12px',
                                  color: '#f4f4f5',
                                  fontFamily: "'JetBrains Mono',monospace",
                                  colorScheme: 'dark',
                                }}
                              />
                            </div>

                            <div style={{ fontSize: '11px', color: v.formSasHintColor, lineHeight: '1.5' }}>
                              {v.formSasHint}
                            </div>
                          </div>
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
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                          {'10'}
                        </span>
                        {'Étapes'}
                      </label>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(v.formActions ?? []).map((a: ViewItem, $index: number) => (
                          <Fragment key={listKey(a, $index)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  fontFamily: "'JetBrains Mono',monospace",
                                  fontSize: '11px',
                                  color: '#52525b',
                                  width: '60px',
                                }}
                              >
                                {'étape ' + (a?.n ?? '') + ''}
                              </span>

                              <input
                                value={a?.value ?? ''}
                                onChange={a?.onChange}
                                placeholder={'étape à venir'}
                                style={{
                                  flex: '1',
                                  background: '#09090b',
                                  border: '1px solid #27272a',
                                  borderRadius: '10px',
                                  padding: '9px 12px',
                                  fontSize: '12.5px',
                                  color: '#f4f4f5',
                                }}
                              />
                            </div>
                          </Fragment>
                        ))}

                        <button
                          onClick={v.formAddStep}
                          style={{
                            background: '#09090b',
                            color: '#a1a1aa',
                            border: '1px dashed #27272a',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            marginLeft: '70px',
                          }}
                          className={'cosmos-hover-65'}
                        >
                          {'+ Ajouter une étape'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}

                {v.tab3 ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
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
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                            {'11'}
                          </span>
                          {'Date de début'}
                        </label>

                        <input
                          type={'date'}
                          value={v.form?.startAt ?? ''}
                          onChange={v.set?.startAt}
                          style={{
                            background: '#09090b',
                            border: '1px solid #27272a',
                            borderRadius: '10px',
                            padding: '9px 12px',
                            fontSize: '12.5px',
                            color: '#f4f4f5',
                            fontFamily: "'JetBrains Mono',monospace",
                            colorScheme: 'dark',
                          }}
                        />

                        {v.formStartsLater ? (
                          <>
                            <div style={{ fontSize: '11px', color: '#d4a054' }}>
                              {'démarre le ' + (v.formStartLabel ?? '') + ' — créé en '}
                              <span style={{ fontWeight: '600' }}>{'Pause'}</span>
                              {", s'active tout seul ce jour-là"}
                            </div>
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
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                            {'12'}
                          </span>
                          {'Échéance'}
                        </label>

                        <div style={{ display: 'flex', gap: '6px', height: '37px', alignItems: 'center' }}>
                          {(v.formEcheanceChips ?? []).map((t: ViewItem, $index: number) => (
                            <Fragment key={listKey(t, $index)}>
                              <button
                                onClick={t?.onClick}
                                style={{
                                  padding: '6px 12px',
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

                        <div style={{ fontSize: '11px', color: '#52525b' }}>{v.formEcheanceHint}</div>
                      </div>
                    </div>

                    {v.formIsDated ? (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            padding: '14px 16px',
                            borderRadius: '14px',
                            border: '1px solid rgba(39,39,42,0.8)',
                            background: 'rgba(24,24,27,0.35)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                            }}
                          >
                            <label
                              style={{
                                fontSize: '11.5px',
                                fontWeight: '600',
                                color: '#a1a1aa',
                                display: 'flex',
                                gap: '8px',
                              }}
                            >
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                                {'13'}
                              </span>
                              {'Date de clôture'}
                            </label>

                            <span style={{ fontSize: '11.5px', color: '#71717a' }}>
                              {'retenu : '}
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#f4f4f5' }}>
                                {v.formClotureLabel}
                              </span>
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr', gap: '8px' }}>
                            <input
                              type={'date'}
                              key={v.formClotureDate}
                              value={v.formClotureDate ?? ''}
                              onChange={v.set?.cloture}
                              style={{
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                fontFamily: "'JetBrains Mono',monospace",
                                colorScheme: 'dark',
                                minWidth: '0',
                              }}
                            />

                            <select
                              value={v.formClotureSel?.rel ?? ''}
                              onChange={v.pickFormCloture}
                              style={{
                                width: '100%',
                                padding: '9px 10px',
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
                              value={v.formClotureSel?.month ?? ''}
                              onChange={v.pickFormCloture}
                              style={{
                                width: '100%',
                                padding: '9px 10px',
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
                              value={v.formClotureSel?.quarter ?? ''}
                              onChange={v.pickFormCloture}
                              style={{
                                width: '100%',
                                padding: '9px 10px',
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
                              value={v.formClotureSel?.year ?? ''}
                              onChange={v.pickFormCloture}
                              style={{
                                width: '100%',
                                padding: '9px 10px',
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

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label
                            style={{
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#fbbf24',
                              display: 'flex',
                              gap: '8px',
                            }}
                          >
                            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#52525b' }}>
                              {'14'}
                            </span>
                            {'Préavis de tension '}
                            <span style={{ fontWeight: '400', color: '#52525b' }}>
                              {'— jours avant la clôture où la projection passe en Tension'}
                            </span>
                          </label>

                          <div
                            style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}
                          >
                            <input
                              type={'number'}
                              min={'0'}
                              value={v.form?.alertDays ?? ''}
                              onChange={v.set?.alertDays}
                              style={{
                                width: '90px',
                                background: '#09090b',
                                border: '1px solid #27272a',
                                borderRadius: '10px',
                                padding: '9px 12px',
                                fontSize: '12.5px',
                                color: '#f4f4f5',
                                fontFamily: "'JetBrains Mono',monospace",
                              }}
                            />

                            {(v.formAlertChips ?? []).map((c: ViewItem, $index: number) => (
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
                  </>
                ) : null}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 22px',
                  borderTop: '1px solid rgba(39,39,42,0.8)',
                }}
              >
                <span style={{ fontSize: '11.5px', color: v.formHintColor }}>{v.formHint}</span>

                <div style={{ display: 'flex', gap: '8px' }}>
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
                    className={'cosmos-hover-66'}
                  >
                    {'Annuler'}
                  </button>

                  {v.notLastTab ? (
                    <>
                      <button
                        onClick={v.nextTab}
                        style={{
                          background: '#09090b',
                          color: '#f4f4f5',
                          border: '1px solid #3f3f46',
                          padding: '8px 13px',
                          borderRadius: '10px',
                          fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {'Suivant ›'}
                      </button>
                    </>
                  ) : null}

                  <button
                    onClick={v.saveMini}
                    disabled={v.miniInvalid}
                    style={{
                      background: '#fafafa',
                      color: '#09090b',
                      border: 'none',
                      padding: '8px 15px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      opacity: v.miniBtnOpacity,
                    }}
                    className={'cosmos-hover-67'}
                  >
                    {'Créer le mini-cosmos'}
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
