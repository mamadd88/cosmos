import type { Key } from 'react';
// Les collections du contrôleur JavaScript sont progressivement typées à la frontière TSX.
// Les valeurs de premier niveau sont inférées depuis renderVals, les collections JSON restent extensibles.
export type ViewItem = Record<string, any>;
export function listKey(item: unknown, index: number): Key {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    for (const key of ['id', 'key', 'day', 'domain', 'label', 'name']) {
      if (typeof record[key] === 'string' || typeof record[key] === 'number') return record[key];
    }
  }
  return index;
}
