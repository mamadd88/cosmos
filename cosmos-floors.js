// Les identifiants restent stables ; seuls les titres affichés sont personnalisables.
export const FLOOR_TITLE_MAX_LENGTH = 300;
export const COSMOS_FLOORS = [
  { id: 'pathos', label: 'PATHOS', title: 'PATHOS — L’ÉNERGIE' },
  { id: 'ethos', label: 'ETHOS', title: 'ETHOS — LA CRÉDIBILITÉ' },
  { id: 'logos', label: 'LOGOS', title: 'LOGOS — L’ORDRE' },
];
export function normalizeFloorTitles(value) {
  return Object.fromEntries(
    COSMOS_FLOORS.flatMap(({ id }) => {
      const title = typeof value?.[id] === 'string' ? value[id].trim() : '';
      return title && title.length <= FLOOR_TITLE_MAX_LENGTH ? [[id, title]] : [];
    }),
  );
}
export function floorTitle(titles, id) {
  return normalizeFloorTitles(titles)[id] || COSMOS_FLOORS.find((floor) => floor.id === id)?.title || '';
}
