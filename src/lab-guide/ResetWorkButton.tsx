// "Nulstil arbejde" button + native <dialog> confirm — shared between PhaseFooter (in-guide) and LabLanding so the wipe affordance reads identically in both places.
import { useEffect, useRef, useState } from 'react';
import { strings } from './strings.da';

interface Props {
  /** Invoked when the student confirms the reset. The caller decides what
   *  "reset" means — `resetLab()` from RunnerContext inside the guide, a bare
   *  `wipe(experimentId)` plus a re-render tick on the landing page. */
  onConfirm: () => void;
}

export function ResetWorkButton({ onConfirm }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Native <dialog> is opened imperatively via showModal() so it gets the
  // browser's free Esc handling, focus management, and backdrop.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (confirmOpen && !d.open) d.showModal();
    if (!confirmOpen && d.open) d.close();
  }, [confirmOpen]);

  return (
    <div className="mt-8 border-t border-slate-200 pt-4 no-print">
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
      >
        {strings.guide.resetWork}
      </button>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is mouse-only by
          design; keyboard users close via Esc (handled by onCancel) or the Annuller button. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="reset-confirm-title"
        onCancel={() => setConfirmOpen(false)}
        onClose={() => setConfirmOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setConfirmOpen(false);
        }}
        className="rounded-lg shadow-xl max-w-md w-full p-6 backdrop:bg-slate-900/40"
      >
        <h2 id="reset-confirm-title" className="text-lg font-semibold text-navy mb-2">
          {strings.guide.resetWorkConfirmTitle}
        </h2>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line">
          {strings.guide.resetWorkConfirmBody}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="text-sm text-slate-700 hover:underline px-2 py-1"
          >
            {strings.guide.resetWorkConfirmCancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              setConfirmOpen(false);
            }}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-500 text-white hover:bg-red-600"
          >
            {strings.guide.resetWorkConfirmAction}
          </button>
        </div>
      </dialog>
    </div>
  );
}
