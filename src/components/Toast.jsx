import { useEffect } from 'react';
import { useEditor } from '../state/EditorContext.jsx';

/**
 * Toast stack — bottom-right.
 *
 * Each toast has a `ttl` (ms); a single setTimeout per toast dismisses it. We
 * pause the dismissal timer while the user hovers so they have time to read.
 */
export function Toasts() {
  const { state, dispatch } = useEditor();
  const toasts = state.toasts;

  return (
    <div className="cc-toasts" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dispatch={dispatch} />
      ))}
    </div>
  );
}

function ToastItem({ toast, dispatch }) {
  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: 'toast/dismiss', id: toast.id }), toast.ttl);
    return () => clearTimeout(id);
  }, [toast.id, toast.ttl, dispatch]);

  return (
    <div className={`cc-toast cc-toast--${toast.kind}`} role="status">
      <span className="cc-toast__bar" />
      <div className="cc-toast__icon">{iconFor(toast.kind)}</div>
      <div className="cc-toast__msg">{toast.message}</div>
      <button
        className="cc-toast__close"
        onClick={() => dispatch({ type: 'toast/dismiss', id: toast.id })}
        aria-label="dismiss"
      >
        ✕
      </button>
    </div>
  );
}

function iconFor(kind) {
  switch (kind) {
    case 'success': return '✓';
    case 'error':   return '!';
    case 'warn':    return '⚠';
    default:        return 'ⓘ';
  }
}
