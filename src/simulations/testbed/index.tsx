import type { SimulationProps } from '@/sim-contract';
import { useEffect, useState } from 'react';
import { meta } from './meta';

interface TestbedState {
  flag: boolean;
  value: number;
}

export default function Testbed({ paused = false, onProgress, onState }: SimulationProps) {
  const [flag, setFlag] = useState(false);
  const [value, setValue] = useState(0);
  const [datapoints, setDatapoints] = useState(0);
  const [milestoneFired, setMilestoneFired] = useState(false);

  useEffect(() => {
    onState?.({ flag, value } satisfies TestbedState);
  }, [flag, value, onState]);

  return (
    <div
      className="flex flex-col gap-3 p-4 border rounded bg-white"
      aria-busy={paused || undefined}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Gate testbed</h3>
        {paused && <span className="text-xs text-slate-500">(paused)</span>}
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <button
          type="button"
          disabled={paused}
          className="px-3 py-2 rounded bg-navy text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => {
            onProgress?.({ type: 'milestone', id: 'm1' });
            setMilestoneFired(true);
          }}
        >
          Fyr milestone <code>m1</code>
          {milestoneFired && <span className="ml-2">✓</span>}
        </button>
        <button
          type="button"
          disabled={paused}
          className="px-3 py-2 rounded bg-navy text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => {
            onProgress?.({ type: 'data-collected', count: 1 });
            setDatapoints((n) => n + 1);
          }}
        >
          Tilføj datapunkt (lokalt: {datapoints})
        </button>
        <button
          type="button"
          disabled={paused}
          className="px-3 py-2 rounded bg-navy text-white hover:opacity-90 disabled:opacity-50"
          onClick={() => setFlag((f) => !f)}
        >
          Toggle prædikat-flag (nu: {flag ? 'true' : 'false'})
        </button>
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">Værdi: {value}</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={value}
            disabled={paused}
            onChange={(e) => setValue(Number(e.target.value))}
            className="flex-1"
          />
        </label>
      </div>
    </div>
  );
}

export { meta };

export const gates = {
  'flag-on': (state: unknown) => Boolean((state as TestbedState | null)?.flag),
  'value-above-5': (state: unknown) => Number((state as TestbedState | null)?.value ?? 0) > 5,
};
