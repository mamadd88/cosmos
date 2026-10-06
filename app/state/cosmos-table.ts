import { COLORS, statutOf } from '../../cosmos-core.js';
import { COSMOS_FLOORS, floorTitle } from '../../cosmos-floors.js';
import type { ViewItem } from './view-items';

type CosmosTableState = {
  cosmos: string[];
  rows: ViewItem[];
  sections: { id: string; name: string; etage: string }[];
  sectionDe: Record<string, string>;
  etageDe: Record<string, string>;
  titresDe: Record<string, string[]>;
  titresEtages?: Record<string, string>;
};
type CosmosRubrique = { name: string; minis: ViewItem[] };
export type CosmosItem = {
  name: string;
  color: string;
  minis: ViewItem[];
  rubriques: CosmosRubrique[];
};
export type CosmosGroup = { id: string; name: string; items: CosmosItem[] };
const normalize = (text: unknown) =>
  String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('œ', 'oe');

function groupRubriques(minis: ViewItem[], titles: string[], showEmpty: boolean): CosmosRubrique[] {
  const byTitle = new Map<string, ViewItem[]>([['', []]]);
  titles.forEach((title) => byTitle.set(title, []));
  minis.forEach((mini) => {
    const title = mini.titre || '';
    const rows = byTitle.get(title) || [];
    rows.push(mini);
    byTitle.set(title, rows);
  });
  return Array.from(byTitle, ([name, rows]) => ({ name, minis: rows })).filter(
    (rubrique) => rubrique.minis.length || (showEmpty && !!rubrique.name),
  );
}

// Regroupement d’affichage uniquement : l’ordre enregistré et les données restent inchangés.
export function buildCosmosFloors(state: CosmosTableState, query: string, status: string, dragging = false) {
  const needle = normalize(query.trim());
  const matches = (text: unknown) => !needle || normalize(text).includes(needle);
  const rowsByCosmos = new Map<string, ViewItem[]>();
  state.rows.forEach((mini) => {
    const rows = rowsByCosmos.get(mini.cosmos) || [];
    rows.push(mini);
    rowsByCosmos.set(mini.cosmos, rows);
  });
  return COSMOS_FLOORS.map((floor) => {
    const sections = state.sections.filter((section) => section.etage === floor.id);
    const groups: CosmosGroup[] = [
      { id: 'unassigned-' + floor.id, name: '', items: [] },
      ...sections.map((section) => ({ id: section.id, name: section.name, items: [] })),
    ];
    const bySection = new Map(groups.map((group) => [group.id, group]));
    const names = state.cosmos.filter((name) => (state.etageDe[name] || 'logos') === floor.id);
    const populatedSections = new Set<string>();
    names.forEach((name) => {
      const group = bySection.get(state.sectionDe[name]) || groups[0];
      populatedSections.add(group.id);
      const source = rowsByCosmos.get(name) || [];
      const parent = group.name + ' ' + name;
      const minis = source.filter(
        (mini) =>
          dragging ||
          ((status === 'Tous' || statutOf(mini) === status) &&
            matches(
              [
                parent,
                mini.titre,
                mini.name,
                mini.objectif,
                mini.actuel,
                mini.entropie,
                mini.reponse,
                mini.alerte,
                mini.kill,
                mini.sas,
                ...(mini.actions || []).map((action: ViewItem) => action.text),
              ].join(' '),
            )),
      );
      if (!dragging && !minis.length && !(source.length === 0 && status === 'Tous' && matches(parent)))
        return;
      group.items.push({
        name,
        color: COLORS[state.cosmos.indexOf(name) % COLORS.length],
        minis,
        rubriques: groupRubriques(
          minis,
          state.titresDe[name] || [],
          dragging || (!needle && status === 'Tous'),
        ),
      });
    });
    const visibleGroups = groups.filter((group) => {
      if (group.items.length) return true;
      if (
        group.name &&
        (dragging || (!populatedSections.has(group.id) && status === 'Tous' && matches(group.name)))
      ) {
        return true;
      }
      return false;
    });
    return {
      ...floor,
      title: floorTitle(state.titresEtages, floor.id),
      label: state.titresEtages?.[floor.id] ? floorTitle(state.titresEtages, floor.id) : floor.label,
      groups: visibleGroups,
      cosmosCount: visibleGroups.reduce((n, group) => n + group.items.length, 0),
      miniCount: visibleGroups.reduce(
        (n, group) => n + group.items.reduce((sum, item) => sum + item.minis.length, 0),
        0,
      ),
    };
  });
}
