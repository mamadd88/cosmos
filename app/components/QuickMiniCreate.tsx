import { useId, useRef } from 'react';
import { useCosmos } from '../state/CosmosContext';

export function QuickMiniCreate({
  cosmos,
  titre,
  disabled: blocked = false,
  onCreated,
}: {
  cosmos: string;
  titre?: string;
  disabled?: boolean;
  onCreated?: () => void;
}) {
  const { controller } = useCosmos();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const draft = controller.state.quickDrafts[cosmos] || { name: '', error: '' };
  const disabled =
    blocked || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  return (
    <form
      className="quick-mini-create"
      aria-label={'Création rapide dans ' + cosmos}
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        if (controller.quickCreate(cosmos)) {
          onCreated?.();
          input.current?.focus();
        }
      }}
    >
      <span aria-hidden="true" className="quick-mini-plus">
        +
      </span>
      <input
        ref={input}
        type="text"
        aria-label={'Nouveau mini-cosmos dans ' + cosmos}
        placeholder="Ajouter un mini-cosmos…"
        value={draft.name}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={!!draft.error}
        aria-describedby={draft.error ? errorId : undefined}
        onChange={(event) => controller.setQuickName(cosmos, event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            (event.nativeEvent.isComposing || event.repeat || event.keyCode === 229)
          )
            event.preventDefault();
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            controller.setQuickName(cosmos, '');
          }
        }}
      />
      <button
        type="submit"
        aria-label={'Créer un mini-cosmos dans ' + cosmos}
        disabled={disabled || !draft.name.trim()}
        title="Entrée pour créer"
      >
        Ajouter ↵
      </button>
      {titre ? <span className="quick-mini-context">Sous « {titre} »</span> : null}
      {draft.error ? (
        <span id={errorId} role="alert" className="quick-mini-error">
          {draft.error}
        </span>
      ) : null}
    </form>
  );
}
