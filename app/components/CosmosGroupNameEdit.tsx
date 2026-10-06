import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos } from '../state/CosmosContext';
type Group = { id: string; name: string; etage: string };

export default function CosmosGroupNameEdit({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { controller } = useCosmos();
  const group = (controller.state.sections as Group[]).find((item) => item.id === id);
  const [name, setName] = useState(group?.name || '');
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const error = controller.state.sectionError;
  const disabled =
    !group || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const close = () => controller.setState({ groupAction: null, sectionError: '' });
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const scope = input.current?.closest('main');
    return () => {
      if (controller.state.groupAction?.type === 'rename' && controller.state.groupAction.id === id)
        controller.setState({ groupAction: null, sectionError: '' });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-group-actions]'))
          .find((button) => button.dataset.groupActions === id)
          ?.focus();
      }, 0);
    };
  }, [controller, id]);
  return (
    <form
      className="ct-group-inline-edit"
      aria-label="Modifier le groupe"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.repeat || event.keyCode === 229))
          event.preventDefault();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const state = controller.state;
        if (
          !state.ready ||
          state.syncRefreshing ||
          state.needsLogin ||
          state.groupAction?.type !== 'rename' ||
          state.groupAction.id !== id
        )
          return;
        const latest = (state.sections as Group[]).find((item) => item.id === id);
        if (latest && controller.saveSection({ ...latest, name })) {
          onSaved();
          close();
        }
      }}
    >
      <input
        ref={input}
        aria-label="Nom du groupe"
        value={name}
        maxLength={60}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setName(event.target.value);
          controller.setState({ sectionError: '' });
        }}
      />
      <button type="submit" disabled={disabled || !name.trim()}>
        Enregistrer
      </button>
      <button type="button" onClick={close}>
        Annuler
      </button>
      {error ? (
        <span id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
