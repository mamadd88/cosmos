import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos, type Controller } from '../state/CosmosContext';
import CosmosHeaderActions from './CosmosHeaderActions';

type GroupAction = NonNullable<Controller['state']['groupAction']>;
type Group = { id: string; name: string; etage: string };

export function CosmosGroupActions({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const { controller } = useCosmos();
  return (
    <CosmosHeaderActions<GroupAction['type']>
      label={'Actions du groupe ' + name}
      menuLabel={'Actions du groupe ' + name}
      focusTarget={{ 'data-group-actions': id }}
      disabled={disabled}
      actions={[
        { type: 'rename', label: 'Modifier' },
        { type: 'delete', label: 'Supprimer', danger: true },
      ]}
      onSelect={(type) => {
        const state = controller.state;
        if (disabled || !state.ready || state.syncRefreshing || state.needsLogin) return;
        controller.setState({ groupAction: { type, id }, sectionError: '' });
      }}
    />
  );
}

export function CosmosGroupActionDialog({
  action,
  onDone,
}: {
  action: GroupAction;
  onDone: (action: GroupAction, group: Group) => void;
}) {
  const { controller } = useCosmos();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const group = (controller.state.sections as Group[]).find((section) => section.id === action.id);
  const creating = action.type === 'create';
  const [name, setName] = useState(creating ? '' : group?.name || '');
  const [error, setError] = useState('');
  const deleting = action.type === 'delete';
  const disabled =
    !group || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  const total = (controller.state.cosmos as string[]).filter(
    (cosmos) => (controller.state.sectionDe as Record<string, string>)[cosmos] === action.id,
  ).length;
  const close = () => controller.setState({ groupAction: null, sectionError: '' });
  useEffect(() => {
    const element = dialog.current!;
    const scope = element.closest('main');
    element.showModal();
    (input.current || cancel.current)?.focus();
    return () => {
      if (element.open) element.close();
      if (controller.state.groupAction === action)
        controller.setState({ groupAction: null, sectionError: '' });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-group-actions]'))
          .find((button) => button.dataset.groupActions === action.id)
          ?.focus();
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
          if (!state.ready || state.syncRefreshing || state.needsLogin || state.groupAction !== action)
            return;
          const latest = (state.sections as Group[]).find((section) => section.id === action.id);
          if (!latest) {
            setError('Ce groupe n’existe plus.');
            return;
          }
          if (creating) {
            if (!name.trim()) {
              setError('Saisis un nom de cosmos.');
              return;
            }
            if (
              (state.cosmos as string[]).some((cosmos) => cosmos.toUpperCase() === name.trim().toUpperCase())
            ) {
              setError('Ce cosmos existe déjà.');
              return;
            }
            if (!controller.creerCosmos(name, action.id)) return;
          } else if (deleting) {
            controller.deleteSection(action.id);
          } else if (!controller.saveSection({ ...latest, name })) {
            setError(controller.state.sectionError);
            return;
          }
          onDone(action, latest);
          close();
        }}
      >
        <h2 id={titleId}>
          {deleting ? 'Supprimer le groupe' : creating ? 'Créer un cosmos' : 'Modifier le groupe'}
        </h2>
        <p id={descriptionId}>
          {deleting
            ? `Supprimer le groupe ${group?.name || ''} ? Ses ${total} cosmos et leurs mini-cosmos seront conservés dans ${controller.state.titresEtages[group?.etage || ''] || (group?.etage || '').toUpperCase()}, au-dessus des autres groupes.`
            : creating
              ? `Dans le groupe ${group?.name || ''}`
              : group?.name}
        </p>
        {!deleting ? (
          <label>
            {creating ? 'Nom du cosmos' : 'Nom du groupe'}
            <input
              ref={input}
              value={name}
              disabled={disabled}
              autoComplete="off"
              maxLength={creating ? undefined : 60}
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
        {error || !group ? (
          <p id={errorId} role="alert">
            {error || 'Ce groupe n’existe plus.'}
          </p>
        ) : null}
        <div className="ct-cosmos-dialog-footer">
          <button ref={cancel} type="button" onClick={close}>
            Annuler
          </button>
          <button
            type="submit"
            className={deleting ? 'ct-action-danger' : undefined}
            disabled={disabled || (!deleting && !name.trim())}
          >
            {deleting ? 'Supprimer' : creating ? 'Créer le cosmos' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
