import { useEffect, useId, useRef } from 'react';
import { useCosmos } from '../state/CosmosContext';

export default function CosmosGroupCreate({
  floor,
  label,
  onCreated,
  onClose,
}: {
  floor: string;
  label: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const { controller } = useCosmos();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const { editSection: draft, sectionError: error } = controller.state;
  const disabled = !controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin;
  useEffect(() => {
    input.current?.focus();
    return () => {
      if (controller.state.editSection?.etage === floor && !controller.state.editSection.id)
        controller.setState({ editSection: null, sectionError: '' });
    };
  }, [controller, floor]);
  if (!draft || draft.etage !== floor || draft.id) return null;
  const cancel = () => {
    controller.setState({ editSection: null, sectionError: '' });
    onClose();
  };
  return (
    <form
      className="ct-group-create"
      aria-label={'Créer un groupe dans ' + label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!controller.state.ready || controller.state.syncRefreshing || controller.state.needsLogin) return;
        const latest = controller.state.editSection;
        if (!latest || latest.etage !== floor || latest.id) return;
        controller.saveSection();
        if (!controller.state.editSection) {
          onCreated();
          controller.flash('Groupe créé dans ' + label);
          onClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.repeat || event.keyCode === 229))
          event.preventDefault();
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        }
      }}
    >
      <input
        ref={input}
        id={'ct-group-name-' + floor}
        value={draft.name}
        placeholder="Nom du groupe…"
        aria-label={'Nom du groupe dans ' + label}
        maxLength={60}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) =>
          controller.setState({ editSection: { ...draft, name: event.target.value }, sectionError: '' })
        }
      />
      <button type="submit" disabled={disabled || !draft.name.trim()}>
        Créer
      </button>
      <button type="button" onClick={cancel}>
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
