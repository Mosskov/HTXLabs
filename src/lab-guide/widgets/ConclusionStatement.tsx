import { useEffect } from 'react';
import { useRunner } from '../RunnerContext';
import { ProtectedTextarea } from './ProtectedInput';

interface Props {
  id: string;
  prompt: string;
  maxChars?: number;
}

export function ConclusionStatement({ id, prompt, maxChars = 300 }: Props) {
  const { state, setWidgetValue, registerWidgetState } = useRunner();
  const value = (state.widgetValues[id] as string | undefined) ?? '';
  const filled = value.trim().length > 0;

  useEffect(() => {
    registerWidgetState(id, { kind: 'filled', filled });
    return () => registerWidgetState(id, null);
  }, [id, filled, registerWidgetState]);

  return (
    <div className="my-4">
      <label htmlFor={`conc-${id}`} className="block text-sm font-medium text-slate-800 mb-1">
        {prompt}
      </label>
      <ProtectedTextarea
        id={`conc-${id}`}
        value={value}
        maxLength={maxChars}
        rows={3}
        onChange={(e) => setWidgetValue(id, e.target.value)}
      />
      <div className="mt-1 text-xs text-slate-500 text-right">
        {value.length} / {maxChars}
      </div>
    </div>
  );
}
