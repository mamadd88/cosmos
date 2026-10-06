import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos, type Controller } from '../state/CosmosContext';
import type { ViewItem } from '../state/view-items';
import CosmosHeaderActions from './CosmosHeaderActions';

type RubriqueAction = NonNullable<Controller['state']['rubriqueAction']>;
const actionKey = (cosmos: string, name: string) => JSON.stringify([cosmos, name]);
const namesOf = (controller: Controller, cosmos: string): string[] => [
  ...controller.titresOf(cosmos),
  ...(controller.state.rows as ViewItem[])
    .filter((mini) => mini.cosmos === cosmos && mini.titre)
    .map((mini) => mini.titre),
];

export function CosmosRubriqueActions({
  cosmos,
  name,
  disabled,
}: {
  cosmos: string;
  name: string;
  disabled: boolean;
}) {
  const { controller } = useCosmos();
  return (
    <CosmosHeaderActions<RubriqueAction['type']>
      label={`Actions de la séparation ${name} dans ${cosmos}`}
      menuLabel={`Actions de la séparation ${name} dans ${cosmos}`}
      focusTarget={{ 'data-rubrique-actions': actionKey(cosmos, name) }}
      disabled={disabled}
      actions={[
        { type: 'rename', label: 'Modifier' },
        { type: 'delete', label: 'Supprimer', danger: true },
      ]}
      onSelect={(type) => {
        const state = controller.state;
        if (!state.ready || state.syncRefreshing || state.needsLogin || disabled) return;
        controller.setState({ rubriqueAction: { type, cosmos, name } });
      }}
    />
  );
}

export function CosmosRubriqueActionDialog({ action }: { action: RubriqueAction }) {
  const { controller } = useCosmos();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const focusName = useRef(action.name);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [name, setName] = useState(action.name);
  const [error, setError] = useState('');
  const deleting = action.type === 'delete';
  const exists =
    (controller.state.cosmos as string[]).includes(action.cosmos) &&
    namesOf(controller, action.cosmos).includes(action.name);
  const disabled =
    !exists || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const total = (controller.state.rows as ViewItem[]).filter(
    (mini) => mini.cosmos === action.cosmos && mini.titre === action.name,
  ).length;
  const close = () => controller.setState({ rubriqueAction: null });
  useEffect(() => {
    const element = dialog.current!;
    const scope = element.closest('main');
    element.showModal();
    (input.current || cancelButton.current)?.focus();
    return () => {
      if (element.open) element.close();
      if (controller.state.rubriqueAction === action) controller.setState({ rubriqueAction: null });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        const trigger = Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-rubrique-actions]')).find(
          (button) => button.dataset.rubriqueActions === actionKey(action.cosmos, focusName.current),
        );
        const parent = Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-cosmos-actions]')).find(
          (button) => button.dataset.cosmosActions === action.cosmos,
        );
        (trigger || parent || scope.querySelector<HTMLInputElement>('input[type="search"]'))?.focus();
      }, 0);
    };
  }, [action, controller]);

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
          if (!state.ready || state.syncRefreshing || state.needsLogin || state.rubriqueAction !== action)
            return;
          const titles = namesOf(controller, action.cosmos);
          if (!(state.cosmos as string[]).includes(action.cosmos) || !titles.includes(action.name)) {
            setError('Cette séparation n’existe plus.');
            return;
          }
          if (deleting) {
            if (!controller.supprimerTitre(action.cosmos, action.name)) return;
          } else {
            const nextName = name.trim();
            if (!nextName || nextName.length > 60) {
              setError('Choisis un nom de 1 à 60 caractères.');
              return;
            }
            if (
              titles.some((title) => title !== action.name && title.toLowerCase() === nextName.toLowerCase())
            ) {
              setError('Cette séparation existe déjà dans ce cosmos.');
              return;
            }
            if (!controller.renommerTitre(action.cosmos, action.name, nextName)) return;
            focusName.current = nextName;
          }
          close();
        }}
      >
        <h2 id={titleId}>{deleting ? 'Supprimer la séparation' : 'Modifier la séparation'}</h2>
        <p id={descriptionId}>
          {deleting
            ? `Supprimer la séparation « ${action.name} » ? Ses ${total} mini-cosmos seront conservés dans ${action.cosmos}, sans séparation.`
            : `${action.name} · ${action.cosmos}`}
        </p>
        {!deleting ? (
          <label>
            Nom de la séparation
            <input
              ref={input}
              value={name}
              disabled={disabled}
              autoComplete="off"
              maxLength={60}
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
            {error || 'Cette séparation n’existe plus.'}
          </p>
        ) : null}
        <div className="ct-cosmos-dialog-footer">
          <button ref={cancelButton} type="button" onClick={close}>
            Annuler
          </button>
          <button
            type="submit"
            className={deleting ? 'ct-action-danger' : undefined}
            disabled={disabled || (!deleting && !name.trim())}
          >
            {deleting ? 'Supprimer' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
