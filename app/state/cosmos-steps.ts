import { projectionOf } from '../../cosmos-core.js';
import type { ViewItem } from './view-items';

export type CosmosStep = { text: string; done: boolean };

export function cosmosStepsOf(mini: ViewItem) {
  const steps = ((mini.actions || []) as CosmosStep[])
    .map((step, index) => ({ ...step, index }))
    .filter((step) => step.text.trim());
  const total = steps.length;
  const done = steps.filter((step) => step.done).length;
  const tone = !total
    ? 'empty'
    : done === total
      ? 'done'
      : projectionOf(mini).zone === 'retard'
        ? 'late'
        : 'pending';
  const colors = { empty: '#f59e0b', done: '#34d399', late: '#fb7185', pending: '#e4e4e7' };
  const hints = {
    empty: 'Aucune étape définie',
    done: 'Toutes les étapes sont terminées',
    late: 'Des étapes restent à faire et l’échéance est dépassée',
    pending: 'Des étapes restent à faire',
  };
  return { steps, total, done, tone, color: colors[tone], hint: hints[tone], label: `${done}/${total}` };
}
