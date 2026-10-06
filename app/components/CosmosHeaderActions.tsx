import { useEffect, useId, useRef, useState } from 'react';

export default function CosmosHeaderActions<T extends string>({
  label,
  menuLabel,
  focusTarget,
  disabled,
  actions,
  onSelect,
}: {
  label: string;
  menuLabel: string;
  focusTarget:
    | { 'data-cosmos-actions': string }
    | { 'data-group-actions': string }
    | { 'data-rubrique-actions': string };
  disabled: boolean;
  actions: { type: T; label: string; danger?: boolean }[];
  onSelect: (type: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    if (disabled) {
      setOpen(false);
      return;
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, disabled]);
  return (
    <div ref={wrapper} className="ct-cosmos-actions">
      <button
        ref={trigger}
        type="button"
        className="ct-actions-toggle"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        {...focusTarget}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>
      {open ? (
        <div id={id} className="ct-cosmos-action-list" role="group" aria-label={menuLabel}>
          {actions.map((action) => (
            <button
              key={action.type}
              type="button"
              className={action.danger ? 'ct-action-danger' : undefined}
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                setOpen(false);
                onSelect(action.type);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
