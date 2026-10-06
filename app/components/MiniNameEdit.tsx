import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos } from '../state/CosmosContext';
import type { ViewItem } from '../state/view-items';

export default function MiniNameEdit({ id }: { id: string }) {
  const { controller } = useCosmos();
  const mini = (controller.state.rows as ViewItem[]).find((item) => item.id === id);
  const [name, setName] = useState<string>(mini?.name || '');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const disabled =
    !mini || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const close = () => controller.setState({ miniNameEditId: null });
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const scope = input.current?.closest('main');
    return () => {
      if (controller.state.miniNameEditId === id) controller.setState({ miniNameEditId: null });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-mini-rename]'))
          .find((button) => button.dataset.miniRename === id)
          ?.focus();
      }, 0);
    };
  }, [controller, id]);
  return (
    <form
      className="ct-group-inline-edit"
      aria-label="Modifier le nom du mini-cosmos"
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
        if (controller.state.miniNameEditId !== id || disabled) return;
        const failure = controller.renameMini(id, name);
        if (failure) setError(failure);
        else close();
      }}
    >
      <input
        ref={input}
        aria-label="Nom du mini-cosmos"
        value={name}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setError('');
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
