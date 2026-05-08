import { useEffect } from 'react';
import { useRunner } from '../RunnerContext';
import { format, strings } from '../strings.da';
import { ProtectedTextarea } from './ProtectedInput';

interface Props {
  id: string;
  prompt: string;
  minWords?: number;
  /** Override the default "Skriv dit svar her..." placeholder. */
  placeholder?: string;
  /** Override the default below-threshold hint. Receives no interpolation —
   * supply the full literal string. */
  tooShortMessage?: string;
}

/** Free-text reflection. Persists to runner; gate via { type: 'all-filled', widgetIds: [...] }. */
export function Reflection({ id, prompt, minWords, placeholder, tooShortMessage }: Props) {
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
    tooShortMessage ?? format(strings.widgets.reflection.tooShort, { n: minWords ?? 0 });

  return (
    <div className="my-4">
      <label htmlFor={`refl-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`refl-${id}`}
        value={value}
        placeholder={placeholder ?? strings.widgets.reflection.placeholder}
        onChange={(e) => setWidgetValue(id, e.target.value)}
      />
      {tooShort && <p className="mt-1 text-xs text-amber-700">{tooShortText}</p>}
    </div>
  );
}
