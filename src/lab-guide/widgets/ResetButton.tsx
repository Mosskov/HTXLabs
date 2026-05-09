import { useRunner } from '../RunnerContext';
import { strings } from '../strings.da';

interface Props {
  /** Override the default button label. */
  label?: string;
  /** Override the default confirm-dialog message. */
  confirmMessage?: string;
}

/** Testbed-only widget: wipes the current experiment's saved state and
 * resets the runner in place. Currently used in the hej-verden lab to
 * verify the fresh-start experience. */
export function ResetButton({ label, confirmMessage }: Props = {}) {
  const { resetLab } = useRunner();

  function handleClick() {
    const confirmed = window.confirm(confirmMessage ?? strings.widgets.resetButton.confirm);
    if (!confirmed) return;
    resetLab();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-8 rounded border border-red-300 bg-red-50 px-4 py-2 text-red-700 hover:bg-red-100"
    >
      {label ?? strings.widgets.resetButton.label}
    </button>
  );
}
