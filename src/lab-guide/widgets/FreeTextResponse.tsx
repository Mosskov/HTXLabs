import { useEffect } from 'react';
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { ProtectedTextarea } from './ProtectedInput';

interface Props {
  id: string;
  prompt: string;
  /** Optional minimum word floor; below it the gate stays unfilled and an
   * amber hint shows. */
  minWords?: number;
  /** Optional hard character cap; when set, an `X / Y` counter is shown. */
  maxChars?: number;
  /** Override the default placeholder. */
  placeholder?: string;
  /** Override the default below-threshold hint. Receives no interpolation —
   * supply the full literal string. */
  tooShortMessage?: string;
}

/** Generic free-text response. Persists to runner; gate via
 * `{ type: 'all-filled', widgetIds: [...] }`. Both quantity constraints
 * (minWords floor, maxChars ceiling) are optional. */
export function FreeTextResponse({
  id,
  prompt,
  minWords,
  maxChars,
  placeholder,
  tooShortMessage,
}: Props) {
  const { state, setWidgetValue, registerWidgetState } = useRunner();
  const value = (state.widgetValues[id] as string | undefined) ?? '';
  const nonEmpty = value.trim().length > 0;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const meetsMinWords = typeof minWords !== 'number' || words >= minWords;
  const filled = nonEmpty && meetsMinWords;
  const tooShort = nonEmpty && !meetsMinWords;

  // No unmount cleanup: the registered state must outlive a phase change so the
  // gate stays satisfied when the student navigates away and back.
  useEffect(() => {
    registerWidgetState(id, { kind: 'filled', filled });
  }, [id, filled, registerWidgetState]);

  const tooShortText =
    tooShortMessage ?? format(strings.widgets.freeText.tooShort, { n: minWords ?? 0 });

  return (
    <div className="my-4">
      <label htmlFor={`ft-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`ft-${id}`}
        value={value}
        maxLength={maxChars}
        placeholder={placeholder ?? strings.widgets.freeText.placeholder}
        onChange={(e) => setWidgetValue(id, e.target.value)}
      />
      {tooShort && <p className="mt-1 text-xs text-amber-700">{tooShortText}</p>}
      {typeof maxChars === 'number' && (
        <div className="mt-1 text-xs text-slate-500 text-right">
          {value.length} / {maxChars}
        </div>
      )}
    </div>
  );
}
