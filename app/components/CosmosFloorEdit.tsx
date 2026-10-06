import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { FLOOR_TITLE_MAX_LENGTH, floorTitle } from '../../cosmos-floors.js';

export default function CosmosFloorEdit({ floor }: { floor: string }) {
  const { controller } = useCosmos();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();
  const [title, setTitle] = useState(() => floorTitle(controller.state.titresEtages, floor));
  const [error, setError] = useState('');
  const disabled = !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const close = () => controller.setState({ editFloor: null });
  useEffect(() => {
    const element = dialog.current!;
    const scope = element.closest('main');
    element.showModal();
    input.current?.focus();
    input.current?.select();
    return () => {
      if (element.open) element.close();
      if (controller.state.editFloor === floor) controller.setState({ editFloor: null });
      setTimeout(() => {
        if (scope?.isConnected) document.getElementById('ct-edit-floor-' + floor)?.focus();
      }, 0);
    };
  }, [controller, floor]);
  return (
    <dialog
      ref={dialog}
      className="ct-cosmos-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (controller.state.editFloor !== floor) return;
          if (!title.trim() || title.trim().length > FLOOR_TITLE_MAX_LENGTH) {
            setError(`Choisis un titre de 1 à ${FLOOR_TITLE_MAX_LENGTH} caractères.`);
            return;
          }
          if (controller.renameFloor(floor, title)) close();
        }}
      >
        <h2 id={titleId}>Modifier le titre de l’espace</h2>
        <label>
          Titre de l’espace
          <input
            ref={input}
            value={title}
            disabled={disabled}
            autoComplete="off"
            maxLength={FLOOR_TITLE_MAX_LENGTH}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              setError('');
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.nativeEvent.isComposing || event.repeat || event.keyCode === 229)
              )
                event.preventDefault();
            }}
          />
        </label>
        {error ? (
          <p id={errorId} role="alert">
            {error}
          </p>
        ) : null}
        <div className="ct-cosmos-dialog-footer">
          <button type="button" onClick={close}>
            Annuler
          </button>
          <button type="submit" disabled={disabled || !title.trim()}>
            Enregistrer
          </button>
        </div>
      </form>
    </dialog>
  );
}
