import { useEffect, useId, useRef, useState } from 'react';
import { useCosmos } from '../state/CosmosContext';
import { cosmosStepsOf, type CosmosStep } from '../state/cosmos-steps';
import type { ViewItem } from '../state/view-items';

export default function CosmosStepsDialog({ mini, onClose }: { mini: ViewItem; onClose: () => void }) {
  const { controller } = useCosmos();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [text, setText] = useState('');
  const summary = cosmosStepsOf(mini);
  const disabled = !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const updateSteps = (change: (steps: CosmosStep[]) => CosmosStep[]) => {
    const state = controller.state;
    if (!state.ready || state.syncRefreshing || state.needsLogin) return false;
    const current = (state.rows as ViewItem[]).find((row) => row.id === mini.id);
    if (!current) return false;
    return controller.update(mini.id, { actions: change(current.actions || []) }, undefined);
  };

  return (
    <dialog
      ref={dialogRef}
      className="ct-steps-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <div className="ct-steps-dialog-heading">
        <div>
          <h2 id={titleId}>Étapes de {mini.name}</h2>
          <p>
            <span className="ct-steps-count" style={{ color: summary.color }}>
              {summary.label}
            </span>
            <span>{summary.hint}</span>
          </p>
        </div>
        <button type="button" className="ct-steps-close" onClick={onClose} aria-label="Fermer les étapes">
          ×
        </button>
      </div>
      {summary.steps.length ? (
        <ul className="ct-steps-list">
          {summary.steps.map((step) => (
            <li key={step.index}>
              <label>
                <input
                  type="checkbox"
                  checked={step.done}
                  disabled={disabled}
                  onChange={(event) => {
                    const done = event.target.checked;
                    updateSteps((steps) =>
                      steps.map((item, index) => (index === step.index ? { ...item, done } : item)),
                    );
                  }}
                />
                <span className={step.done ? 'ct-step-done' : undefined}>{step.text}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ct-steps-empty">Ajoute une première étape pour préciser la prochaine action.</p>
      )}
      <form
        className="ct-step-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = text.trim();
          if (!name) return;
          if (updateSteps((steps) => [...steps, { text: name, done: false }])) {
            setText('');
            inputRef.current?.focus();
          }
        }}
      >
        <label htmlFor={inputId}>Nouvelle étape</label>
        <div>
          <input
            id={inputId}
            ref={inputRef}
            value={text}
            disabled={disabled}
            placeholder="Décrire une action…"
            autoComplete="off"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.nativeEvent.isComposing || event.repeat || event.keyCode === 229)
              )
                event.preventDefault();
            }}
          />
          <button type="submit" disabled={disabled || !text.trim()}>
            Ajouter
          </button>
        </div>
      </form>
    </dialog>
  );
}
