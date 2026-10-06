import { Fragment, useEffect, useMemo, useState, type MouseEvent } from 'react';
import CosmosKpis from '../components/CosmosKpis';
import { isDraft, notStarted } from '../../cosmos-core.js';
import CosmosStepsDialog from '../components/CosmosStepsDialog';
import CosmosGroupCreate from '../components/CosmosGroupCreate';
import CosmosGroupNameEdit from '../components/CosmosGroupNameEdit';
import MiniNameEdit from '../components/MiniNameEdit';
import MiniDeleteDialog from '../components/MiniDeleteDialog';
import CosmosFloorEdit from '../components/CosmosFloorEdit';
import { CosmosGroupActions, CosmosGroupActionDialog } from '../components/CosmosGroupActions';
import { QuickMiniCreate } from '../components/QuickMiniCreate';
import { CosmosActions, CosmosActionDialog } from '../components/CosmosActions';
import { CosmosRubriqueActions, CosmosRubriqueActionDialog } from '../components/CosmosRubriqueActions';
import { useCosmos } from '../state/CosmosContext';
import { buildCosmosFloors, type CosmosGroup } from '../state/cosmos-table';
import { cosmosStepsOf } from '../state/cosmos-steps';
import { useCosmosDrag, type CosmosDrag } from '../state/cosmos-drag';
import { useCosmosFolds } from '../state/cosmos-folds';
import type { ViewItem } from '../state/view-items';

const columns = [
  ['name', 'Groupe / Cosmos / Mini-cosmos'],
  ['objectif', 'Objectif'],
  ['actuel', 'Valeur actuelle'],
  ['steps', 'Étapes'],
  ['entropie', 'Entropie'],
  ['reponse', 'Réponse entropie'],
  ['alerte', 'Alerte'],
  ['kill', 'Kill'],
  ['status', 'Statut'],
  ['projection', 'Projection'],
];

function CellText({ value }: { value: unknown }) {
  return value != null && value !== '' && value !== '—' ? (
    <span className="ct-text">{String(value)}</span>
  ) : (
    <span className="ct-empty" aria-label="Non renseigné">
      —
    </span>
  );
}

function isHeaderBackgroundClick(event: MouseEvent<HTMLElement>) {
  return (
    !event.defaultPrevented &&
    !(event.target as Element).closest(
      'button, a, input, select, textarea, [role="button"], [contenteditable]',
    ) &&
    !window.getSelection()?.toString()
  );
}

function GroupRows({
  group,
  closed,
  toggleNode,
  expanded,
  toggleText,
  openSteps,
  drag,
  onMiniCreated,
  onGroupRenamed,
}: {
  group: CosmosGroup;
  closed: Set<string>;
  toggleNode: (id: string) => void;
  expanded: Set<string>;
  toggleText: (id: string) => void;
  openSteps: (id: string) => void;
  drag: CosmosDrag;
  onMiniCreated: (cosmos: string, groupId: string) => void;
  onGroupRenamed: (groupId: string, closed: boolean) => void;
}) {
  const { controller } = useCosmos();
  const editingName =
    controller.state.groupAction?.type === 'rename' && controller.state.groupAction.id === group.id;
  const sectionKey = 'section:' + group.id;
  const sectionClosed = !!group.name && closed.has(sectionKey);
  const actionsDisabled =
    !!drag.active ||
    !controller.state.ready ||
    controller.state.syncRefreshing ||
    controller.state.needsLogin ||
    !!controller.state.editSection ||
    !!controller.state.cosmosAction ||
    !!controller.state.miniDeleteId ||
    !!controller.state.miniNameEditId ||
    !!controller.state.groupAction ||
    !!controller.state.rubriqueAction ||
    !!controller.state.editFloor ||
    !!(controller.state as ViewItem).editing;
  const togglePause = (id: string) => {
    const state = controller.state;
    if (!state.ready || state.syncRefreshing || state.needsLogin) return;
    const mini = (state.rows as ViewItem[]).find((row) => row.id === id);
    if (!mini || mini.closed || (!isDraft(mini) && notStarted(mini))) return;
    const pause = !mini.pause;
    if (controller.update(id, { pause }, undefined))
      controller.flash(mini.name + (pause ? ' en pause' : ' repris'));
  };
  return (
    <tbody>
      {group.name ? (
        <tr
          className={'ct-section-row' + (group.items.length ? ' ct-clickable-header' : '')}
          {...drag.targetProps({ type: 'section', id: group.id })}
          {...drag.sourceProps({ type: 'section', id: group.id }, 'le groupe ' + group.name)}
          onClick={(event) => {
            if (!editingName && group.items.length && isHeaderBackgroundClick(event)) toggleNode(sectionKey);
          }}
        >
          <th scope="row" className="ct-name-cell ct-section-cell">
            <button {...drag.handleProps({ type: 'section', id: group.id }, 'le groupe ' + group.name)}>
              <span aria-hidden="true">⠿</span>
            </button>
            {editingName ? (
              <CosmosGroupNameEdit id={group.id} onSaved={() => onGroupRenamed(group.id, sectionClosed)} />
            ) : (
              <div className="ct-group-name">
                <button
                  type="button"
                  className="ct-node-button"
                  disabled={!group.items.length}
                  aria-expanded={group.items.length ? !sectionClosed : undefined}
                  aria-label={(sectionClosed ? 'Déplier' : 'Replier') + ' le groupe ' + group.name}
                  onClick={() => toggleNode(sectionKey)}
                >
                  <span className="ct-node-chevron" aria-hidden="true">
                    {group.items.length ? (sectionClosed ? '▸' : '▾') : '·'}
                  </span>
                  <span className="ct-node-name">{group.name}</span>
                  <span className="ct-node-count">{group.items.length} cosmos</span>
                </button>
                <button
                  type="button"
                  className="ct-group-rename"
                  aria-label={'Modifier le nom du groupe ' + group.name}
                  title="Modifier le nom"
                  disabled={actionsDisabled}
                  onClick={() => {
                    if (!actionsDisabled)
                      controller.setState({
                        groupAction: { type: 'rename', id: group.id },
                        sectionError: '',
                      });
                  }}
                >
                  ✎
                </button>
              </div>
            )}
          </th>
          <td colSpan={columns.length - 1} className="ct-cosmos-actions-cell">
            <div className="ct-group-line-actions">
              <button
                type="button"
                className="ct-add-group"
                disabled={actionsDisabled}
                aria-label={'Créer un cosmos dans le groupe ' + group.name}
                onClick={() => {
                  if (!actionsDisabled)
                    controller.setState({ groupAction: { type: 'create', id: group.id }, sectionError: '' });
                }}
              >
                + Cosmos
              </button>
              <CosmosGroupActions id={group.id} name={group.name} disabled={actionsDisabled} />
            </div>
          </td>
        </tr>
      ) : null}
      {!sectionClosed
        ? group.items.map((cosmos) => {
            const cosmosKey = 'cosmos:' + cosmos.name;
            const cosmosClosed = closed.has(cosmosKey);
            return (
              <Fragment key={cosmos.name}>
                <tr
                  className="ct-cosmos-row ct-clickable-header"
                  {...drag.targetProps({ type: 'cosmos', name: cosmos.name })}
                  {...drag.sourceProps({ type: 'group', id: cosmos.name }, 'le cosmos ' + cosmos.name)}
                  onClick={(event) => {
                    if (isHeaderBackgroundClick(event)) toggleNode(cosmosKey);
                  }}
                >
                  <th scope="row" className="ct-name-cell ct-cosmos-cell">
                    <button
                      {...drag.handleProps({ type: 'group', id: cosmos.name }, 'le cosmos ' + cosmos.name)}
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                    <div className="ct-cosmos-name">
                      <button
                        type="button"
                        className="ct-node-button"
                        aria-expanded={!cosmosClosed}
                        aria-label={(cosmosClosed ? 'Déplier' : 'Replier') + ' le cosmos ' + cosmos.name}
                        onClick={() => toggleNode(cosmosKey)}
                      >
                        <span className="ct-node-chevron" aria-hidden="true">
                          {cosmosClosed ? '▸' : '▾'}
                        </span>
                        <span
                          className="ct-cosmos-color"
                          style={{ background: cosmos.color }}
                          aria-hidden="true"
                        />
                        <span className="ct-node-name">{cosmos.name}</span>
                        <span className="ct-node-count">{cosmos.minis.length || 'Aucun'} mini-cosmos</span>
                      </button>
                      <button
                        type="button"
                        className="ct-group-rename"
                        title="Modifier le cosmos"
                        aria-label={'Modifier le cosmos ' + cosmos.name}
                        disabled={actionsDisabled}
                        onClick={() => {
                          if (!actionsDisabled)
                            controller.setState({ cosmosAction: { type: 'rename', cosmos: cosmos.name } });
                        }}
                      >
                        <span aria-hidden="true">✎</span>
                      </button>
                      <button
                        type="button"
                        className="ct-group-rename ct-inline-delete"
                        title="Supprimer le cosmos"
                        aria-label={'Supprimer le cosmos ' + cosmos.name}
                        disabled={actionsDisabled}
                        onClick={() => {
                          if (!actionsDisabled)
                            controller.setState({ cosmosAction: { type: 'delete', cosmos: cosmos.name } });
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </th>
                  <td colSpan={columns.length - 1} className="ct-cosmos-actions-cell">
                    <CosmosActions cosmos={cosmos.name} disabled={actionsDisabled} />
                  </td>
                </tr>
                {!cosmosClosed
                  ? cosmos.rubriques.map((rubrique) => (
                      <Fragment key={rubrique.name}>
                        {rubrique.name ? (
                          <tr
                            className="ct-rubrique-row"
                            {...drag.targetProps({
                              type: 'rubrique',
                              cosmos: cosmos.name,
                              name: rubrique.name,
                            })}
                          >
                            <th scope="row" className="ct-name-cell ct-rubrique-cell">
                              <span className="ct-rubrique-tag">{rubrique.name}</span>
                            </th>
                            <td colSpan={columns.length - 1} className="ct-cosmos-actions-cell">
                              <CosmosRubriqueActions
                                cosmos={cosmos.name}
                                name={rubrique.name}
                                disabled={actionsDisabled}
                              />
                            </td>
                          </tr>
                        ) : null}
                        {rubrique.minis.map((mini: ViewItem) => {
                          const detail = controller.decorate(mini);
                          const fullText = expanded.has(mini.id);
                          const steps = cosmosStepsOf(mini);
                          const canPause = !mini.closed && (isDraft(mini) || !detail.notStarted);
                          const pauseAction = mini.pause ? 'Reprendre' : 'Mettre en pause';
                          return (
                            <tr
                              key={mini.id}
                              className={'ct-mini-row' + (fullText ? ' ct-expanded' : '')}
                              {...drag.targetProps({ type: 'row', id: mini.id })}
                              {...drag.sourceProps(
                                { type: 'row', id: mini.id },
                                'le mini-cosmos ' + mini.name,
                              )}
                              onClick={(event) => {
                                if (controller.state.miniNameEditId === mini.id) return;
                                if ((event.target as Element).closest('button, a, input, select, textarea'))
                                  return;
                                if (window.getSelection()?.toString()) return;
                                detail.open();
                              }}
                            >
                              <th scope="row" className="ct-name-cell ct-mini-cell">
                                <button
                                  {...drag.handleProps(
                                    { type: 'row', id: mini.id },
                                    'le mini-cosmos ' + mini.name,
                                  )}
                                >
                                  <span aria-hidden="true">⠿</span>
                                </button>
                                {controller.state.miniNameEditId === mini.id ? (
                                  <MiniNameEdit id={mini.id} />
                                ) : (
                                  <div className="ct-mini-name">
                                    <button
                                      type="button"
                                      className="ct-mini-button"
                                      onClick={detail.open}
                                      aria-label={'Ouvrir la fiche de ' + mini.name}
                                    >
                                      <span
                                        className="ct-weight"
                                        style={{
                                          background: detail.poidsBg,
                                          borderColor: detail.poidsBorder,
                                        }}
                                        aria-label={'Poids ' + detail.poidsLabel}
                                      />
                                      <span>{mini.name}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ct-group-rename"
                                      data-mini-rename={mini.id}
                                      aria-label={'Modifier le nom du mini-cosmos ' + mini.name}
                                      title="Modifier le nom"
                                      disabled={actionsDisabled}
                                      onClick={() => {
                                        if (!actionsDisabled)
                                          controller.setState({ miniNameEditId: mini.id });
                                      }}
                                    >
                                      <span aria-hidden="true">✎</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ct-group-rename ct-inline-delete"
                                      title="Supprimer le mini-cosmos"
                                      data-mini-delete={mini.id}
                                      aria-label={'Supprimer le mini-cosmos ' + mini.name}
                                      disabled={actionsDisabled}
                                      onClick={() => {
                                        if (!actionsDisabled) controller.setState({ miniDeleteId: mini.id });
                                      }}
                                    >
                                      <span aria-hidden="true">×</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="ct-text-toggle"
                                      onClick={() => toggleText(mini.id)}
                                      aria-expanded={fullText}
                                      aria-label={
                                        (fullText ? 'Réduire les textes de ' : 'Développer les textes de ') +
                                        mini.name
                                      }
                                      title={fullText ? 'Réduire les textes' : 'Développer les textes'}
                                    >
                                      <span aria-hidden="true">{fullText ? '▴' : '▾'}</span>
                                    </button>
                                  </div>
                                )}
                              </th>
                              <td>
                                <CellText value={mini.objectif} />
                              </td>
                              <td className="ct-actual">
                                <CellText value={mini.actuel} />
                              </td>
                              <td className="ct-steps-cell">
                                <button
                                  type="button"
                                  className="ct-steps-count"
                                  style={{ color: steps.color }}
                                  aria-label={
                                    'Étapes de ' + mini.name + ' : ' + steps.label + ' · ' + steps.hint
                                  }
                                  aria-haspopup="dialog"
                                  title={steps.hint + ' · Cliquer pour voir les étapes'}
                                  onClick={() => openSteps(mini.id)}
                                >
                                  {steps.label}
                                </button>
                              </td>
                              <td>
                                <CellText value={detail.entropie} />
                              </td>
                              <td>
                                <CellText value={detail.reponse} />
                              </td>
                              <td className="ct-alert">
                                <CellText value={mini.alerte} />
                              </td>
                              <td className="ct-kill">
                                <CellText value={mini.kill} />
                              </td>
                              <td className="ct-status-cell">
                                <button
                                  type="button"
                                  className="ct-status"
                                  style={{ color: detail.statutColor, background: detail.statutBg }}
                                  disabled={
                                    !canPause ||
                                    !controller.state.ready ||
                                    controller.state.syncRefreshing ||
                                    controller.state.needsLogin
                                  }
                                  aria-label={
                                    detail.statut + ' — ' + (canPause ? pauseAction + ' ' : '') + mini.name
                                  }
                                  title={
                                    mini.closed
                                      ? 'Ce mini-cosmos est clôturé.'
                                      : !canPause
                                        ? 'Démarre le ' + detail.startLabel
                                        : pauseAction + (mini.pause && detail.sasPending ? ' le SAS' : '')
                                  }
                                  onClick={() => togglePause(mini.id)}
                                >
                                  {detail.statut}
                                </button>
                              </td>
                              <td className="ct-projection">
                                {detail.isDated ? (
                                  <div
                                    style={{ color: detail.projColor }}
                                    title={[detail.projRange, detail.projPreavisLabel, detail.projThen]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  >
                                    <span className="ct-projection-zone">{detail.projZoneLabel}</span>
                                    <span
                                      className="ct-projection-track"
                                      role="meter"
                                      aria-label={'Temps écoulé pour ' + mini.name}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-valuenow={parseFloat(detail.projPct)}
                                      aria-valuetext={
                                        detail.projPct + ' du temps écoulé · ' + detail.projLabel
                                      }
                                    >
                                      <span style={{ width: detail.projPct, background: detail.projColor }} />
                                    </span>
                                    <span className="ct-projection-meta">
                                      <span className="ct-projection-date">
                                        {detail.clotureIsSas ? 'Fin du SAS · ' : ''}
                                        {detail.clotureShort}
                                      </span>
                                      <span className="ct-projection-days">{detail.projLabel}</span>
                                    </span>
                                  </div>
                                ) : detail.isPermanent ? (
                                  <span className="ct-projection-continuous">∞ Continu</span>
                                ) : (
                                  <CellText value="" />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))
                  : null}
                {!cosmosClosed ? (
                  <tr className="ct-quick-create-row">
                    <td colSpan={columns.length}>
                      <QuickMiniCreate
                        cosmos={cosmos.name}
                        titre={controller.titresOf(cosmos.name).at(-1)}
                        reveal={false}
                        disabled={
                          !!drag.active ||
                          !!controller.state.editSection ||
                          !!controller.state.cosmosAction ||
                          !!controller.state.miniDeleteId ||
                          !!controller.state.miniNameEditId ||
                          !!controller.state.groupAction ||
                          !!controller.state.rubriqueAction ||
                          !!controller.state.editFloor
                        }
                        onCreated={() => onMiniCreated(cosmos.name, group.id)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })
        : null}
    </tbody>
  );
}

export default function CosmosPage() {
  const { controller } = useCosmos();
  const state = controller.state;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Tous');
  const [closed, setClosed] = useCosmosFolds(controller);
  const [filteredClosed, setFilteredClosed] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [stepsId, setStepsId] = useState<string | null>(null);
  useEffect(() => {
    const name = state.revealCosmos;
    if (!state.ready || !name) return;
    if ((controller.state.cosmos as string[]).includes(name)) {
      setQuery('');
      setStatus('Tous');
      setFilteredClosed(new Set());
      setClosed((previous) => {
        const next = new Set(previous);
        next.delete('floor:' + controller.etageOf(name));
        const group = (controller.state.sectionDe as Record<string, string>)[name];
        if (group) next.delete('section:' + group);
        next.delete('cosmos:' + name);
        return next;
      });
    }
    controller.setState({ revealCosmos: null });
  }, [controller, state.ready, state.revealCosmos, setClosed]);
  useEffect(() => {
    if (!state.createdCosmos) return;
    const key = 'cosmos:' + state.createdCosmos;
    setClosed((previous) => new Set([...previous, key]));
    setFilteredClosed((previous) => new Set([...previous, key]));
    controller.setState({ createdCosmos: null });
  }, [controller, state.createdCosmos, setClosed]);
  const stepsMini = (state.rows as ViewItem[]).find((mini) => mini.id === stepsId);
  const filtering = !!query.trim() || status !== 'Tous';
  const visibleClosed = filtering ? filteredClosed : closed;
  const drag = useCosmosDrag(controller);
  const dragging = !!drag.active;
  const groupCreationDisabled =
    dragging ||
    !state.ready ||
    state.syncRefreshing ||
    state.needsLogin ||
    !!state.cosmosAction ||
    !!state.miniDeleteId ||
    !!state.miniNameEditId ||
    !!state.groupAction ||
    !!state.rubriqueAction ||
    !!state.editFloor;
  const displayClosed = useMemo(
    () => new Set([...visibleClosed].filter((node) => !drag.opened.has(node))),
    [visibleClosed, drag.opened],
  );
  const floors = useMemo(
    () => buildCosmosFloors(state, query, status, dragging),
    [
      state.cosmos,
      state.rows,
      state.etageDe,
      state.sections,
      state.sectionDe,
      state.titresDe,
      state.titresEtages,
      state.clock,
      query,
      status,
      dragging,
    ],
  );
  const toggleText = (id: string) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleNode = (id: string) =>
    (filtering ? setFilteredClosed : setClosed)((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setAllNodes = (open: boolean) => {
    const next = new Set<string>();
    if (!open) {
      for (const floor of floors) {
        next.add('floor:' + floor.id);
        for (const group of floor.groups) {
          if (group.name) next.add('section:' + group.id);
          for (const cosmos of group.items) next.add('cosmos:' + cosmos.name);
        }
      }
    }
    (filtering ? setFilteredClosed : setClosed)(next);
  };
  if (!state.ready) return null;
  const totalCosmos = floors.reduce((n, floor) => n + floor.cosmosCount, 0);
  const totalMinis = floors.reduce((n, floor) => n + floor.miniCount, 0);
  return (
    <main
      className="cosmos-table"
      onClickCapture={drag.onClickCapture}
      onPointerDownCapture={drag.onPointerDownCapture}
    >
      <span id="ct-drag-instructions" className="ct-sr-only">
        Glisse la ligne ou la poignée pour déplacer. Au clavier : Entrée, flèches pour choisir, Entrée pour
        déposer, Échap pour annuler.
      </span>
      <span className="ct-sr-only" role="status" aria-live="polite">
        {drag.announcement}
      </span>
      <div className="ct-kpis">
        <CosmosKpis />
      </div>
      <div className="ct-toolbar">
        <label className="ct-search">
          <span className="ct-sr-only">Rechercher dans les tableaux</span>
          <input
            type="search"
            disabled={dragging}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setFilteredClosed(new Set());
            }}
            placeholder="Rechercher un groupe, un cosmos, un mini-cosmos…"
          />
        </label>
        <label>
          <span className="ct-sr-only">Filtrer par statut</span>
          <select
            disabled={dragging}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setFilteredClosed(new Set());
            }}
          >
            {['Tous', 'SAS', 'Actif', 'Pause', 'Clôturé'].map((value) => (
              <option key={value} value={value}>
                {value === 'Tous' ? 'Tous les statuts' : value}
              </option>
            ))}
          </select>
        </label>
        <div className="ct-fold-actions" role="group" aria-label="Affichage des accordéons">
          <button type="button" disabled={dragging} onClick={() => setAllNodes(false)}>
            Tout fermer
          </button>
          <button type="button" disabled={dragging} onClick={() => setAllNodes(true)}>
            Tout ouvrir
          </button>
        </div>
        <div className="ct-count" role="status">
          {totalCosmos} cosmos <span>·</span> {totalMinis} mini-cosmos
        </div>
        {query || status !== 'Tous' ? (
          <button
            type="button"
            disabled={dragging}
            onClick={() => {
              setQuery('');
              setStatus('Tous');
              setFilteredClosed(new Set());
            }}
          >
            Réinitialiser
          </button>
        ) : null}
      </div>
      {state.editFloor ? <CosmosFloorEdit key={state.editFloor} floor={state.editFloor} /> : null}
      <div className="ct-floors">
        {floors.map((floor) => {
          const isClosed = displayClosed.has('floor:' + floor.id);
          return (
            <section className="ct-floor" key={floor.id} aria-labelledby={'ct-title-' + floor.id}>
              <div
                className="ct-floor-heading ct-clickable-header"
                {...drag.targetProps({ type: 'floor', id: floor.id })}
                onClick={(event) => {
                  if (isHeaderBackgroundClick(event)) toggleNode('floor:' + floor.id);
                }}
              >
                <h2 id={'ct-title-' + floor.id}>
                  <button
                    type="button"
                    aria-expanded={!isClosed}
                    aria-controls={'ct-content-' + floor.id}
                    onClick={() => toggleNode('floor:' + floor.id)}
                  >
                    <span className="ct-floor-chevron" aria-hidden="true">
                      {isClosed ? '▸' : '▾'}
                    </span>
                    {floor.title}
                  </button>
                </h2>
                <div className="ct-floor-actions">
                  <span className="ct-floor-count">
                    {floor.cosmosCount} cosmos <span className="ct-separator">/</span> {floor.miniCount}{' '}
                    mini-cosmos
                  </span>
                  <button
                    type="button"
                    id={'ct-add-group-' + floor.id}
                    className="ct-add-group"
                    aria-label={'Ajouter un groupe dans ' + floor.label}
                    aria-expanded={state.editSection?.etage === floor.id && !state.editSection.id}
                    disabled={groupCreationDisabled}
                    onClick={() => {
                      if (groupCreationDisabled) return;
                      (filtering ? setFilteredClosed : setClosed)((previous) => {
                        const next = new Set(previous);
                        next.delete('floor:' + floor.id);
                        return next;
                      });
                      if (controller.state.editSection?.etage !== floor.id || controller.state.editSection.id)
                        controller.setState({
                          editSection: { id: null, etage: floor.id, name: '' },
                          sectionError: '',
                        });
                      else document.getElementById('ct-group-name-' + floor.id)?.focus();
                    }}
                  >
                    + Groupe
                  </button>
                  <button
                    type="button"
                    id={'ct-edit-floor-' + floor.id}
                    className="ct-add-group"
                    aria-label={'Modifier le titre de ' + floor.label}
                    aria-haspopup="dialog"
                    disabled={groupCreationDisabled || !!state.editSection}
                    onClick={() => {
                      if (groupCreationDisabled || controller.state.editSection) return;
                      controller.setState({ editFloor: floor.id });
                    }}
                  >
                    Modifier
                  </button>
                </div>
              </div>
              {state.editSection?.etage === floor.id && !state.editSection.id ? (
                <CosmosGroupCreate
                  floor={floor.id}
                  label={floor.label}
                  onCreated={() => {
                    setQuery('');
                    setStatus('Tous');
                    setFilteredClosed(new Set());
                    setClosed((previous) => {
                      const next = new Set(previous);
                      next.delete('floor:' + floor.id);
                      return next;
                    });
                  }}
                  onClose={() => document.getElementById('ct-add-group-' + floor.id)?.focus()}
                />
              ) : null}
              <div id={'ct-content-' + floor.id} hidden={isClosed} className="ct-table-scroll">
                {!isClosed ? (
                  <table aria-label={'Tableau ' + floor.label}>
                    <colgroup>
                      {columns.map(([key]) => (
                        <col key={key} className={'ct-col-' + key} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        {columns.map(([key, label]) => (
                          <th
                            key={key}
                            scope="col"
                            className={
                              key === 'steps'
                                ? 'ct-steps-heading'
                                : key === 'status'
                                  ? 'ct-status-heading'
                                  : undefined
                            }
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    {floor.groups.length ? (
                      floor.groups.map((group) => (
                        <GroupRows
                          key={group.id}
                          group={group}
                          closed={displayClosed}
                          toggleNode={toggleNode}
                          expanded={expanded}
                          toggleText={toggleText}
                          openSteps={setStepsId}
                          drag={drag}
                          onGroupRenamed={(groupId, wasClosed) => {
                            setQuery('');
                            setStatus('Tous');
                            setFilteredClosed(new Set());
                            setClosed((previous) => {
                              const next = new Set(previous);
                              next.delete('floor:' + floor.id);
                              if (wasClosed) next.add('section:' + groupId);
                              else next.delete('section:' + groupId);
                              return next;
                            });
                          }}
                          onMiniCreated={(cosmos, groupId) => {
                            setQuery('');
                            setStatus('Tous');
                            setFilteredClosed(new Set());
                            setClosed((previous) => {
                              const next = new Set(previous);
                              next.delete('floor:' + floor.id);
                              next.delete('section:' + groupId);
                              next.delete('cosmos:' + cosmos);
                              return next;
                            });
                          }}
                        />
                      ))
                    ) : (
                      <tbody>
                        <tr {...drag.targetProps({ type: 'floor', id: floor.id })}>
                          <td colSpan={columns.length} className="ct-no-results">
                            {query || status !== 'Tous'
                              ? 'Aucun résultat dans cet étage.'
                              : 'Aucun cosmos dans cet étage.'}
                          </td>
                        </tr>
                      </tbody>
                    )}
                  </table>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {stepsMini ? (
        <CosmosStepsDialog key={stepsMini.id} mini={stepsMini} onClose={() => setStepsId(null)} />
      ) : null}
      {state.groupAction && state.groupAction.type !== 'rename' ? (
        <CosmosGroupActionDialog
          key={JSON.stringify(state.groupAction)}
          action={state.groupAction}
          onDone={(action, group) => {
            if (action.type === 'create') return;
            const groupKey = 'section:' + action.id;
            const wasClosed = displayClosed.has(groupKey);
            setQuery('');
            setStatus('Tous');
            setFilteredClosed(new Set());
            setClosed((previous) => {
              const next = new Set(previous);
              next.delete('floor:' + group.etage);
              next.delete(groupKey);
              if (action.type === 'rename' && wasClosed) next.add(groupKey);
              return next;
            });
          }}
        />
      ) : null}
      {state.rubriqueAction ? (
        <CosmosRubriqueActionDialog
          key={JSON.stringify(state.rubriqueAction)}
          action={state.rubriqueAction}
        />
      ) : null}
      {state.cosmosAction ? (
        <CosmosActionDialog
          key={JSON.stringify(state.cosmosAction)}
          action={state.cosmosAction}
          onDone={(action, name) => {
            const oldKey = 'cosmos:' + action.cosmos;
            if (action.type === 'delete') {
              for (const update of [setClosed, setFilteredClosed])
                update((previous) => {
                  const next = new Set(previous);
                  next.delete(oldKey);
                  return next;
                });
              return;
            }
            const wasClosed = displayClosed.has(oldKey);
            setQuery('');
            setStatus('Tous');
            setFilteredClosed(new Set());
            setClosed((previous) => {
              const next = new Set(previous);
              next.delete(oldKey);
              next.delete('floor:' + controller.etageOf(name));
              const group = (controller.state.sectionDe as Record<string, string>)[name];
              if (group) next.delete('section:' + group);
              if (action.type === 'rename' && wasClosed) next.add('cosmos:' + name);
              else next.delete('cosmos:' + name);
              return next;
            });
          }}
        />
      ) : null}
      {state.miniDeleteId ? <MiniDeleteDialog key={state.miniDeleteId} id={state.miniDeleteId} /> : null}
      <p className="ct-quote">Le tout est plus que la somme de ses parties.</p>
    </main>
  );
}
