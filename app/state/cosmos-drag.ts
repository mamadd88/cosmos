import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';
import type { Controller } from './CosmosContext';
import type { ViewItem } from './view-items';

export type DragSource = { type: 'row' | 'group' | 'section'; id: string };
export type DropTarget =
  | { type: 'row'; id: string }
  | { type: 'cosmos'; name: string }
  | { type: 'rubrique'; cosmos: string; name: string }
  | { type: 'section'; id: string }
  | { type: 'floor'; id: string };
type Placement = 'before' | 'after' | 'inside';
type Destination = { target: DropTarget; placement: Placement };
const keyOf = (target: DropTarget) => JSON.stringify(target);
const rowsOf = (controller: Controller) => controller.state.rows as ViewItem[];
const sectionsOf = (controller: Controller) => controller.state.sections as ViewItem[];

function sourceExists(controller: Controller, source: DragSource) {
  if (source.type === 'row') return rowsOf(controller).some((row) => row.id === source.id);
  if (source.type === 'group') return (controller.state.cosmos as string[]).includes(source.id);
  return sectionsOf(controller).some((section) => section.id === source.id);
}

function accepts(controller: Controller, source: DragSource, target: DropTarget) {
  if (!sourceExists(controller, source)) return false;
  if (target.type === 'row')
    return (
      source.type === 'row' &&
      source.id !== target.id &&
      rowsOf(controller).some((row) => row.id === target.id)
    );
  if (target.type === 'cosmos')
    return (
      (source.type === 'row' || (source.type === 'group' && source.id !== target.name)) &&
      (controller.state.cosmos as string[]).includes(target.name)
    );
  if (target.type === 'rubrique')
    return (
      source.type === 'row' &&
      (controller.state.cosmos as string[]).includes(target.cosmos) &&
      (controller.titresOf(target.cosmos).includes(target.name) ||
        rowsOf(controller).some((row) => row.cosmos === target.cosmos && row.titre === target.name))
    );
  if (target.type === 'floor')
    return source.type === 'group' && ['ethos', 'logos', 'pathos'].includes(target.id);
  const section = sectionsOf(controller).find((item) => item.id === target.id);
  return (
    !!section &&
    (source.type === 'group' ||
      (source.type === 'section' &&
        source.id !== target.id &&
        sectionsOf(controller).some((item) => item.id === source.id && item.etage === section.etage)))
  );
}

function isInsertion(source: DragSource, target: DropTarget) {
  return (
    (source.type === 'row' && target.type === 'row') ||
    (source.type === 'group' && target.type === 'cosmos') ||
    (source.type === 'section' && target.type === 'section')
  );
}

function canReveal(controller: Controller, source: DragSource, target: DropTarget) {
  if (target.type === 'floor')
    return (
      source.type !== 'section' ||
      sectionsOf(controller).some((item) => item.id === source.id && item.etage === target.id)
    );
  if (target.type === 'section') return source.type === 'row' || source.type === 'group';
  return target.type === 'cosmos' && source.type === 'row';
}

function nodeOf(target: DropTarget) {
  if (target.type === 'floor') return 'floor:' + target.id;
  if (target.type === 'section') return 'section:' + target.id;
  if (target.type === 'cosmos') return 'cosmos:' + target.name;
  return '';
}

export function useCosmosDrag(controller: Controller) {
  const [active, setActive] = useState<DragSource | null>(null);
  const [over, setOver] = useState<Destination | null>(null);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState('');
  const current = useRef<DragSource | null>(null);
  const destination = useRef<Destination | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef('');
  const suppressUntil = useRef(0);
  const keyboard = useRef(false);
  const blockedRow = useRef<string | null>(null);
  const writable = () =>
    controller.state.ready &&
    !controller.state.syncRefreshing &&
    !controller.state.needsLogin &&
    !controller.state.editSection &&
    !controller.state.cosmosAction &&
    !controller.state.groupAction &&
    !controller.state.miniNameEditId &&
    !controller.state.miniDeleteId &&
    !controller.state.rubriqueAction &&
    !controller.state.editFloor &&
    !(controller.state as ViewItem).editing;
  const clearHover = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    hovering.current = '';
  }, []);
  const end = useCallback(() => {
    clearHover();
    if (!current.current) return;
    if (keyboard.current) {
      const sourceKey = JSON.stringify(current.current);
      const targetKey = destination.current ? keyOf(destination.current.target) : null;
      focusTimer.current = setTimeout(() => {
        const handle = Array.from(
          document.querySelectorAll<HTMLButtonElement>('.cosmos-table [data-ct-source]'),
        ).find((node) => node.dataset.ctSource === sourceKey && !node.closest('[hidden]'));
        const target = Array.from(
          document.querySelectorAll<HTMLElement>('.cosmos-table [data-ct-drop]'),
        ).find((node) => node.dataset.ctDrop === targetKey && !node.closest('[hidden]'));
        // Un dépôt dans un groupe fermé peut masquer la source : garder le focus sur sa destination.
        (handle || target?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
      }, 0);
    }
    current.current = null;
    destination.current = null;
    keyboard.current = false;
    suppressUntil.current = Date.now() + 250;
    setActive(null);
    setOver(null);
    setOpened(new Set());
    controller.setState({ drag: null, over: null });
  }, [clearHover, controller]);
  const cancel = useCallback(() => {
    if (current.current) setAnnouncement('Déplacement annulé.');
    end();
  }, [end]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && current.current) {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      }
    };
    document.addEventListener('keydown', escape, true);
    window.addEventListener('dragend', cancel);
    window.addEventListener('blur', cancel);
    return () => {
      document.removeEventListener('keydown', escape, true);
      window.removeEventListener('dragend', cancel);
      window.removeEventListener('blur', cancel);
      clearHover();
      if (focusTimer.current) clearTimeout(focusTimer.current);
      if (current.current) {
        current.current = null;
        controller.setState({ drag: null, over: null });
      }
    };
  }, [cancel, clearHover, controller]);
  useEffect(() => {
    if (current.current && (!writable() || !sourceExists(controller, current.current))) cancel();
  }, [controller.state, cancel]);

  function start(source: DragSource, label: string, byKeyboard: boolean) {
    if (current.current || !writable() || !sourceExists(controller, source)) return false;
    clearHover();
    current.current = source;
    destination.current = null;
    keyboard.current = byKeyboard;
    setActive(source);
    setOver(null);
    setOpened(new Set());
    controller.setState({ drag: source, over: null });
    setAnnouncement(
      label +
        ' sélectionné. ' +
        (byKeyboard
          ? 'Flèches haut et bas pour choisir une destination, gauche et droite pour placer avant ou après, Entrée pour déposer, Échap pour annuler.'
          : 'Glisse vers une destination. Échap pour annuler.'),
    );
    return true;
  }

  function hover(target: DropTarget, placement: Placement) {
    const source = current.current;
    if (!source || !writable()) return;
    const key = keyOf(target);
    if (key !== hovering.current) {
      clearHover();
      hovering.current = key;
      if (canReveal(controller, source, target)) {
        const node = nodeOf(target);
        timer.current = setTimeout(() => {
          if (current.current && hovering.current === key)
            setOpened((previous) => new Set([...previous, node]));
        }, 600);
      }
    }
    const next = { target, placement };
    if (
      keyOf(destination.current?.target || { type: 'floor', id: '' }) !== key ||
      destination.current?.placement !== placement
    ) {
      destination.current = next;
      setOver(next);
    }
  }

  function commit(target: DropTarget, placement: Placement) {
    const source = current.current;
    if (!source || !writable() || !accepts(controller, source, target)) {
      cancel();
      return;
    }
    if (source.type === 'row') {
      if (target.type === 'row') {
        const mini = rowsOf(controller).find((row) => row.id === target.id)!;
        controller.moveRow(source.id, target.id, mini.cosmos, placement);
      } else if (target.type === 'rubrique')
        controller.deposerSurTitre(source.id, target.cosmos, target.name);
      else if (target.type === 'cosmos') controller.moveRow(source.id, null, target.name);
    } else if (source.type === 'group') {
      if (target.type === 'cosmos') controller.moveCosmos(source.id, target.name, placement);
      else if (target.type === 'section') controller.assignSection(source.id, target.id);
      else if (target.type === 'floor') controller.moveCosmosToEtage(source.id, target.id);
    } else if (target.type === 'section') controller.moveSection(source.id, target.id, placement);
    setAnnouncement('Déplacement effectué.');
    end();
  }

  function targetProps(target: DropTarget) {
    const highlighted = over && keyOf(over.target) === keyOf(target);
    const accepted = active && accepts(controller, active, target);
    return {
      'data-ct-drop': keyOf(target),
      'data-drop-position': highlighted ? (accepted ? over.placement : 'open') : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        const source = current.current;
        if (!source) return;
        event.stopPropagation();
        if (!writable()) {
          cancel();
          return;
        }
        const allowed = accepts(controller, source, target);
        if (event.dataTransfer) event.dataTransfer.dropEffect = allowed ? 'move' : 'none';
        if (!allowed && !canReveal(controller, source, target)) {
          clearHover();
          setOver(null);
          destination.current = null;
          return;
        }
        if (allowed) event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const placement = isInsertion(source, target)
          ? event.clientY > rect.top + rect.height / 2
            ? 'after'
            : 'before'
          : 'inside';
        hover(target, placement);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        if (destination.current && keyOf(destination.current.target) === keyOf(target)) {
          clearHover();
          destination.current = null;
          setOver(null);
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!current.current) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const placement = isInsertion(current.current, target)
          ? event.clientY > rect.top + rect.height / 2
            ? 'after'
            : 'before'
          : 'inside';
        commit(target, placement);
      },
    };
  }

  // Le navigateur distingue le clic du glissement, avec le même comportement sur la ligne et la poignée.
  function startNative(event: DragEvent<HTMLElement>, source: DragSource, label: string) {
    event.stopPropagation();
    if (!start(source, label, false)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', source.id);
    const cell = event.currentTarget.closest('tr')?.querySelector('th');
    if (cell) event.dataTransfer.setDragImage?.(cell, 12, 12);
  }

  function handleProps(source: DragSource, label: string) {
    return {
      type: 'button' as const,
      className: 'ct-drag-handle',
      'data-ct-source': JSON.stringify(source),
      draggable: writable(),
      disabled: !writable(),
      'aria-label': 'Déplacer ' + label,
      'aria-describedby': 'ct-drag-instructions',
      title: 'Glisser pour déplacer · Entrée pour déplacer au clavier',
      onClick: (event: MouseEvent) => event.stopPropagation(),
      onDragStart: (event: DragEvent<HTMLButtonElement>) => startNative(event, source, label),
      onDragEnd: end,
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (!current.current && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          event.stopPropagation();
          start(source, label, true);
          return;
        }
        if (!current.current || !keyboard.current) return;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Enter' || event.key === ' ') {
          if (destination.current) commit(destination.current.target, destination.current.placement);
          return;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          if (destination.current && isInsertion(current.current, destination.current.target)) {
            hover(destination.current.target, event.key === 'ArrowLeft' ? 'before' : 'after');
            setAnnouncement(event.key === 'ArrowLeft' ? 'Placer avant.' : 'Placer après.');
          }
          return;
        }
        const candidates = Array.from(
          event.currentTarget.closest('main')!.querySelectorAll<HTMLElement>('[data-ct-drop]'),
        ).filter((node) => {
          const target = JSON.parse(node.dataset.ctDrop!) as DropTarget;
          return (
            accepts(controller, current.current!, target) || canReveal(controller, current.current!, target)
          );
        });
        const index = candidates.findIndex(
          (node) => node.dataset.ctDrop === (destination.current ? keyOf(destination.current.target) : ''),
        );
        const next =
          candidates[(index + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length];
        if (next) {
          const target = JSON.parse(next.dataset.ctDrop!) as DropTarget;
          hover(target, isInsertion(current.current, target) ? 'before' : 'inside');
          next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
          setAnnouncement(
            (next.querySelector('.ct-node-name, .ct-rubrique-tag, .ct-mini-button, h2')?.textContent ||
              next.textContent ||
              '') +
              (accepts(controller, current.current, target)
                ? ' — Entrée pour déposer.'
                : ' — Ouverture pour choisir une destination.'),
          );
        }
      },
    };
  }

  return {
    active,
    opened,
    announcement,
    targetProps,
    handleProps,
    sourceProps: (source: DragSource, label: string) => ({
      'data-dragging': active?.type === source.type && active.id === source.id ? 'true' : undefined,
      draggable: writable(),
      onPointerDownCapture: (event: React.PointerEvent<HTMLElement>) => {
        const control = (event.target as Element).closest(
          'button, a, input, textarea, select, [role="button"], [contenteditable]',
        );
        const blocked =
          event.button !== 0 ||
          event.altKey ||
          (control && !control.matches('.ct-node-button, .ct-mini-button, .ct-drag-handle'));
        blockedRow.current = blocked ? JSON.stringify(source) : null;
      },
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (blockedRow.current === JSON.stringify(source)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        startNative(event, source, label);
      },
      onDragEnd: end,
    }),
    onPointerDownCapture: () => {
      // Un nouveau geste volontaire peut suivre immédiatement un dépôt.
      if (!current.current) {
        suppressUntil.current = 0;
        blockedRow.current = null;
      }
    },
    onClickCapture: (event: MouseEvent) => {
      if (current.current || Date.now() < suppressUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    cancel,
  };
}
export type CosmosDrag = ReturnType<typeof useCosmosDrag>;
