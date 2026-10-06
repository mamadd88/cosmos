import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos, type Controller } from '../state/CosmosContext';
import type { ViewItem } from '../state/view-items';
import CosmosHeaderActions from './CosmosHeaderActions';

export type CosmosAction = NonNullable<Controller['state']['cosmosAction']>;

export function CosmosActions({ cosmos, disabled }: { cosmos: string; disabled: boolean }) {
  const { controller } = useCosmos();
  return (
    <CosmosHeaderActions<CosmosAction['type']>
      label={'Actions du cosmos ' + cosmos}
      menuLabel={'Actions de ' + cosmos}
      focusTarget={{ 'data-cosmos-actions': cosmos }}
      disabled={disabled}
      actions={[
        { type: 'rename', label: 'Modifier' },
        { type: 'delete', label: 'Supprimer', danger: true },
        { type: 'rubrique', label: 'Ajouter une séparation' },
      ]}
      onSelect={(type) => {
        const state = controller.state;
        if (!state.ready || state.syncRefreshing || state.needsLogin) return;
        controller.setState({ cosmosAction: { type, cosmos } });
      }}
    />
  );
}

export function CosmosActionDialog({
  action,
  onDone,
}: {
  action: CosmosAction;
  onDone: (action: CosmosAction, name: string) => void;
}) {
  const { controller } = useCosmos();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const focusName = useRef(action.cosmos);
  const titleId = useId();
  const errorId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(action.type === 'rename' ? action.cosmos : '');
  const [error, setError] = useState('');
  const exists = (controller.state.cosmos as string[]).includes(action.cosmos);
  const disabled =
    !exists || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const total = (controller.state.rows as ViewItem[]).filter((row) => row.cosmos === action.cosmos).length;
  const close = () => controller.setState({ cosmosAction: null });
  useEffect(() => {
    const element = dialog.current!;
    const scope = element.closest('main');
    element.showModal();
    (input.current || cancelButton.current)?.focus();
    return () => {
      if (element.open) element.close();
      if (controller.state.cosmosAction === action) controller.setState({ cosmosAction: null });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-cosmos-actions]'))
          .find((button) => button.dataset.cosmosActions === focusName.current)
          ?.focus();
      }, 0);
    };
  }, [action, controller]);
  const title =
    action.type === 'rename'
      ? 'Modifier le cosmos'
      : action.type === 'delete'
        ? 'Supprimer le cosmos'
        : 'Ajouter une séparation';
  return (
    <dialog
      ref={dialog}
      className="ct-cosmos-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const state = controller.state;
          if (
            !state.ready ||
            state.syncRefreshing ||
            state.needsLogin ||
            state.cosmosAction !== action
          )
            return;
          if (!(state.cosmos as string[]).includes(action.cosmos)) {
            setError('Ce cosmos n’existe plus.');
            return;
          }
          let newName = action.cosmos;
          if (action.type === 'rename') {
            const result = controller.renameCosmos(action.cosmos, name);
            if (result.error || !result.name) {
              setError(result.error);
              return;
            }
            newName = result.name;
          } else if (action.type === 'delete') {
            if (!controller.deleteCosmos(action.cosmos)) return;
          } else {
            if (!name.trim() || name.trim().length > 60) {
              setError('Choisis un nom de 1 à 60 caractères.');
              return;
            }
            if (!controller.creerTitre(action.cosmos, name)) {
              setError('Cette séparation existe déjà dans ce cosmos.');
              return;
            }
          }
          focusName.current = newName;
          onDone(action, newName);
          close();
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>
          {action.type === 'delete'
            ? `${action.cosmos} et ses ${total} mini-cosmos seront supprimés.`
            : action.type === 'rename'
              ? action.cosmos
              : 'Une séparation pour regrouper les mini-cosmos de ' + action.cosmos + '.'}
        </p>
        {action.type !== 'delete' ? (
          <label>
            {action.type === 'rename' ? 'Nom du cosmos' : 'Nom de la séparation'}
            <input
              ref={input}
              value={name}
              disabled={disabled}
              autoComplete="off"
              maxLength={action.type === 'rubrique' ? 60 : undefined}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => {
                setName(event.target.value);
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
        ) : null}
        {error || !exists ? (
          <p id={errorId} role="alert">
            {error || 'Ce cosmos n’existe plus.'}
          </p>
        ) : null}
        <div className="ct-cosmos-dialog-footer">
          <button ref={cancelButton} type="button" onClick={close}>
            Annuler
          </button>
          <button
            type="submit"
            className={action.type === 'delete' ? 'ct-action-danger' : undefined}
            disabled={disabled || (action.type !== 'delete' && !name.trim())}
          >
            {action.type === 'delete' ? 'Supprimer' : action.type === 'rename' ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
