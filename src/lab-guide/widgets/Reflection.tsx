import { useEffect } from 'react';
import { useRunner } from '../RunnerContext';
import { ProtectedTextarea } from './ProtectedInput';

interface Props {
  id: string;
  prompt: string;
  minWords?: number;
}

/** Free-text reflection. Persists to runner; gate via { type: 'all-filled', widgetIds: [...] }. */
export function Reflection({ id, prompt, minWords }: Props) {
  const { state, setWidgetValue, registerWidgetState } = useRunner();
  const value = (state.widgetValues[id] as string | undefined) ?? '';
  const filled = value.trim().length > 0;
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const tooShort = typeof minWords === 'number' && filled && words < minWords;

  useEffect(() => {
    registerWidgetState(id, { kind: 'filled', filled });
    return () => registerWidgetState(id, null);
  }, [id, filled, registerWidgetState]);

  return (
    <div className="my-4">
      <label htmlFor={`refl-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`refl-${id}`}
        value={value}
        placeholder="Skriv dit svar her..."
        onChange={(e) => setWidgetValue(id, e.target.value)}
      />
      {tooShort && (
        <p className="mt-1 text-xs text-amber-700">
          Skriv mindst {minWords} ord for et fyldestgørende svar.
        </p>
      )}
    </div>
  );
}
