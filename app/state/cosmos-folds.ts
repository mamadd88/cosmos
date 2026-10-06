import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Controller } from './CosmosContext';

// Clé conservée pour reprendre les ouvertures enregistrées pendant l’essai.
const STORAGE_KEY = 'cosmos-test-plis-v1';

function readOpenNodes(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (Array.isArray(value?.open))
      return new Set(value.open.filter((node: unknown) => typeof node === 'string'));
  } catch {
    // Sans préférence lisible, tous les accordéons sont fermés.
  }
  return new Set();
}

function nodeKeys(state: Controller['state']) {
  return [
    'floor:ethos',
    'floor:logos',
    'floor:pathos',
    ...(state.sections as { id: string }[]).map((section) => 'section:' + section.id),
    ...(state.cosmos as string[]).map((name) => 'cosmos:' + name),
  ];
}

// Les plis de Cosmos sont des préférences propres au navigateur.
// Seules les ouvertures explicites sont mémorisées : les nouveaux éléments restent fermés.
export function useCosmosFolds(
  controller: Controller,
): [Set<string>, Dispatch<SetStateAction<Set<string>>>] {
  const [open, setOpen] = useState(readOpenNodes);
  const currentOpen = useRef(open);
  const { cosmos, sections } = controller.state;
  const closed = useMemo(
    () => new Set(nodeKeys(controller.state).filter((node) => !open.has(node))),
    [controller, cosmos, sections, open],
  );
  const setClosed = useCallback<Dispatch<SetStateAction<Set<string>>>>(
    (update) => {
      // Les actions de création/renommage peuvent avoir changé les données pendant ce même événement.
      const nodes = nodeKeys(controller.state);
      const previous = new Set(nodes.filter((node) => !currentOpen.current.has(node)));
      const next = typeof update === 'function' ? update(previous) : update;
      const nextOpen = new Set(nodes.filter((node) => !next.has(node)));
      currentOpen.current = nextOpen;
      setOpen(nextOpen);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: [...nextOpen] }));
      } catch {
        // La page reste utilisable quand le stockage local est indisponible.
      }
    },
    [controller],
  );
  return [closed, setClosed];
}
