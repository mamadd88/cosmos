// Le Journal conserve uniquement les changements de « Valeur actuelle ».
// Le même filtre est imposé par Supabase, y compris pour les anciens clients.
export function valueChangeEvent(event) {
  if (event?.type !== 'modification' || !Array.isArray(event.changes)) return null;
  const change = event.changes.find(
    (c) => c?.field === 'Valeur actuelle' && typeof c.before === 'string' && typeof c.after === 'string',
  );
  if (!change || change.before === change.after) return null;
  return {
    ...event,
    detail: 'Valeur actuelle modifiée',
    changes: [{ field: 'Valeur actuelle', before: change.before, after: change.after }],
  };
}

export function valueChangeJournal(events) {
  return Array.isArray(events) ? events.map(valueChangeEvent).filter(Boolean) : [];
}
