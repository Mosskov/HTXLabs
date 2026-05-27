// <input>/<textarea> wrappers blocking copy/paste/drop with toast feedback.
import {
  type ClipboardEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  createContext,
  forwardRef,
  useCallback,
  useContext,
} from 'react';
import { strings } from '../strings.da';
import { ToastContext } from './ToastContext';

/** Per-lab default for paste-block bypass, sourced from
 *  `frontmatter.allowPaste`. ExperimentRoute injects it; ProtectedInput /
 *  ProtectedTextarea read it when their own `allowPaste` prop is undefined.
 *  An explicit widget-level prop still overrides the context (kept so
 *  per-widget tests can opt in without faking a provider). */
export const LabPasteContext = createContext<boolean>(false);

type CommonProps = {
  /** Bypass copy/paste protection. Defaults to the surrounding
   *  `LabPasteContext` (set from per-lab `frontmatter.allowPaste`); pass
   *  explicitly to override per-widget. */
  allowPaste?: boolean;
};

function useGuard(allow: boolean) {
  const { push } = useContext(ToastContext);
  return useCallback(
    (e: ClipboardEvent<HTMLElement> | DragEvent<HTMLElement>) => {
      if (allow) return;
      e.preventDefault();
      push(strings.paste.blocked);
    },
    [allow, push],
  );
}

export const ProtectedInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & CommonProps
>(function ProtectedInput({ allowPaste, className = '', ...rest }, ref) {
  const labAllowPaste = useContext(LabPasteContext);
  const allow = allowPaste ?? labAllowPaste;
  const guard = useGuard(allow);
  return (
    <input
      ref={ref}
      onPaste={guard}
      onCut={guard}
      onDrop={guard}
      onDragOver={(e) => e.preventDefault()}
      onAuxClick={(e) => {
        if (!allow && e.button === 1) e.preventDefault();
      }}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={`block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25 ${className}`}
      {...rest}
    />
  );
});

export const ProtectedTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & CommonProps
>(function ProtectedTextarea({ allowPaste, className = '', ...rest }, ref) {
  const labAllowPaste = useContext(LabPasteContext);
  const allow = allowPaste ?? labAllowPaste;
  const guard = useGuard(allow);
  return (
    <textarea
      ref={ref}
      onPaste={guard}
      onCut={guard}
      onDrop={guard}
      onDragOver={(e) => e.preventDefault()}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={`block w-full min-h-[6rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/25 ${className}`}
      {...rest}
    />
  );
});
