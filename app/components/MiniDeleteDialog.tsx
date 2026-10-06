import { useEffect, useId, useRef } from 'react';
import { useCosmos } from '../state/CosmosContext';
import type { ViewItem } from '../state/view-items';

export default function MiniDeleteDialog({ id }: { id: string }) {
  const { controller } = useCosmos();
  const mini = (controller.state.rows as ViewItem[]).find((row) => row.id === id);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => controller.setState({ miniDeleteId: null });
  const disabled =
    !mini || !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  useEffect(() => {
    const element = dialog.current!;
    const scope = element.closest('main');
    element.showModal();
    cancel.current?.focus();
    return () => {
      if (element.open) element.close();
      if (controller.state.miniDeleteId === id) controller.setState({ miniDeleteId: null });
      setTimeout(() => {
        if (!scope?.isConnected) return;
        const button = Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-mini-delete]')).find(
          (item) => item.dataset.miniDelete === id,
        );
        (button || scope.querySelector<HTMLButtonElement>('.ct-node-button'))?.focus();
      }, 0);
    };
  }, [controller, id]);
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
          if (disabled || controller.state.miniDeleteId !== id) return;
          if (controller.deleteMini(id)) close();
        }}
      >
        <h2 id={titleId}>Supprimer le mini-cosmos</h2>
        <p id={descriptionId}>
          {mini ? `${mini.name} et ses étapes seront supprimés.` : 'Ce mini-cosmos n’existe plus.'}
        </p>
        <div className="ct-cosmos-dialog-footer">
          <button ref={cancel} type="button" onClick={close}>
            Annuler
          </button>
          <button type="submit" className="ct-action-danger" disabled={disabled}>
            Supprimer
          </button>
        </div>
      </form>
    </dialog>
  );
}
