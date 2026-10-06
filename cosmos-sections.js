// Organisation à un seul niveau, partagée par le chargement, l'import et les déplacements.
const ETAGES = ['ethos', 'logos', 'pathos'];
export const sectionEtage = (state, name) =>
  ETAGES.includes(state.etageDe?.[name]) ? state.etageDe[name] : 'logos';
const sameArray = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
export function normalizeOrganization(state) {
  const ids = new Set(),
    names = new Set();
  const sections = (Array.isArray(state.sections) ? state.sections : []).flatMap((section) => {
    if (
      !section ||
      typeof section.id !== 'string' ||
      !section.id ||
      section.id.length > 100 ||
      !ETAGES.includes(section.etage)
    )
      return [];
    const name = typeof section.name === 'string' ? section.name.trim().slice(0, 60) : '';
    const key = section.etage + ':' + name.toLowerCase();
    if (!name || ids.has(section.id) || names.has(key)) return [];
    ids.add(section.id);
    names.add(key);
    return [name === section.name ? section : { id: section.id, name, etage: section.etage }];
  });
  const byId = new Map(sections.map((x, i) => [x.id, { ...x, order: i + 1 }]));
  const sectionDe = Object.fromEntries(
    (state.cosmos || []).flatMap((name) => {
      const id = state.sectionDe?.[name],
        section = byId.get(id);
      return section && section.etage === sectionEtage(state, name) ? [[name, id]] : [];
    }),
  );
  const cosmos = [...(state.cosmos || [])].sort(
    (a, b) =>
      ETAGES.indexOf(sectionEtage(state, a)) - ETAGES.indexOf(sectionEtage(state, b)) ||
      (byId.get(sectionDe[a])?.order || 0) - (byId.get(sectionDe[b])?.order || 0),
  );
  const oldMap = state.sectionDe || {};
  return {
    sections: sameArray(state.sections, sections) ? state.sections : sections,
    sectionDe:
      Object.keys(oldMap).length === Object.keys(sectionDe).length &&
      Object.keys(sectionDe).every((k) => oldMap[k] === sectionDe[k])
        ? oldMap
        : sectionDe,
    cosmos: sameArray(state.cosmos, cosmos) ? state.cosmos : cosmos,
  };
}
