import {
  type ClipboardEvent,
  type DragEvent,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  forwardRef,
  useCallback,
  useContext,
} from 'react';
import { strings } from '../strings.da';
import { ToastContext } from './ToastContext';

type CommonProps = {
  /** Bypass copy/paste protection — only set this from a per-lab `allowPaste: true`. */
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
>(function ProtectedInput({ allowPaste = false, className = '', ...rest }, ref) {
  const guard = useGuard(allowPaste);
  return (
    <input
      ref={ref}
      onPaste={guard}
      onCut={guard}
      onDrop={guard}
      onDragOver={(e) => e.preventDefault()}
      onAuxClick={(e) => {
        if (!allowPaste && e.button === 1) e.preventDefault();
      }}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={`rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${className}`}
      {...rest}
    />
  );
});

export const ProtectedTextarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & CommonProps
>(function ProtectedTextarea({ allowPaste = false, className = '', ...rest }, ref) {
  const guard = useGuard(allowPaste);
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
      className={`w-full min-h-[6rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent ${className}`}
      {...rest}
    />
  );
});
