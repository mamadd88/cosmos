import { normalizeFloorTitles } from '../../cosmos-floors.js';
// Une copie d'affichage, jamais une source de sauvegarde. Le Journal est exclu.
const VERSION = 1;
const MAX_AGE = 24 * 60 * 60 * 1000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Snapshot = {
  cosmos: string[];
  rows: Record<string, any>[];
  etageDe: Record<string, string>;
  etages: Record<string, string>;
  titresEtages?: Record<string, string>;
  titresDe: Record<string, string[]>;
  sections?: { id: string; name: string; etage: string }[];
  sectionDe?: Record<string, string>;
};
const key = (scope: string, userId: string) => `cosmos-startup-v${VERSION}:${scope}:${userId}`;
export function readStartupCache(
  storage: StorageLike | undefined,
  scope: string,
  userId: string,
): Snapshot | null {
  if (!storage || !scope || !userId) return null;
  try {
    const item = JSON.parse(storage.getItem(key(scope, userId)) || 'null');
    const age = Date.now() - item?.savedAt;
    const data = item?.data;
    if (
      item?.version !== VERSION ||
      item?.userId !== userId ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > MAX_AGE
    )
      return null;
    if (
      !Array.isArray(data?.cosmos) ||
      !data.cosmos.every((x: unknown) => typeof x === 'string') ||
      !Array.isArray(data?.rows) ||
      !data.rows.every((x: any) => x && typeof x.id === 'string' && Array.isArray(x.actions))
    )
      return null;
    return {
      cosmos: data.cosmos,
      rows: data.rows,
      etageDe: data.etageDe || {},
      etages: data.etages || {},
      titresEtages: normalizeFloorTitles(data.titresEtages),
      titresDe: data.titresDe || {},
      sections: data.sections || [],
      sectionDe: data.sectionDe || {},
    };
  } catch {
    return null;
  }
}
export function writeStartupCache(
  storage: StorageLike | undefined,
  scope: string,
  userId: string,
  state: Snapshot,
) {
  if (!storage || !scope || !userId) return;
  const { cosmos, rows, etageDe, etages, titresEtages = {}, titresDe, sections = [], sectionDe = {} } = state;
  try {
    storage.setItem(
      key(scope, userId),
      JSON.stringify({
        version: VERSION,
        userId,
        savedAt: Date.now(),
        data: { cosmos, rows, etageDe, etages, titresEtages, titresDe, sections, sectionDe },
      }),
    );
  } catch {
    /* quota ou stockage désactivé : le démarrage réseau reste disponible */
  }
}
export function clearStartupCache(storage: StorageLike | undefined, scope: string, userId: string) {
  try {
    storage?.removeItem(key(scope, userId));
  } catch {
    /* stockage désactivé */
  }
}
