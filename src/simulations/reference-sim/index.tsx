// reference-sim — abstract Y = slope·X + intercept. Emits all three sim-driven
// event kinds (milestone, data-collected, onState-for-predicate) so authors
// have a single canonical example to copy from.
import { formatDK } from '@/lib/numbers';
import type { SimulationProps } from '@/sim-contract';
import { useEffect, useMemo, useState } from 'react';
import { meta } from './meta';
import { type Measurement, computeY, coverWideRange } from './physics';
import { strings } from './strings.da';

interface ReferenceSimState {
  measurements: Measurement[];
  xRange: { min: number; max: number } | null;
}

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export default function ReferenceSim({
  paused = false,
  initialParams,
  onProgress,
  onState,
}: SimulationProps) {
  const params = useMemo(
    () => ({ ...meta.defaultParams, ...(initialParams ?? {}) }),
    [initialParams],
  );
  const slope = Number(params.slope);
  const intercept = Number(params.intercept);

  const [x, setX] = useState(5);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [reviewed, setReviewed] = useState(false);

  const y = computeY(x, slope, intercept);

  // Publish state for predicate gates + DataTable sim-mode mirror.
  useEffect(() => {
    const xs = measurements.map((m) => m.x);
    const xRange = xs.length ? { min: Math.min(...xs), max: Math.max(...xs) } : null;
    onState?.({ measurements, xRange } satisfies ReferenceSimState);
  }, [measurements, onState]);

  function record() {
    const isFirst = measurements.length === 0;
    setMeasurements((prev) => [...prev, { x, y }]);
    onProgress?.({ type: 'data-collected', count: 1 });
    if (isFirst) onProgress?.({ type: 'milestone', id: 'first-measurement' });
  }

  function markReviewed() {
    if (reviewed) return;
    setReviewed(true);
    onProgress?.({ type: 'milestone', id: 'review-completed' });
  }

  return (
    <div
      className="flex flex-col gap-4 p-4 border rounded bg-white"
      aria-busy={paused || undefined}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">{meta.locale?.da?.title ?? meta.title}</h3>
        {paused && <span className="text-xs text-slate-500">{strings.paused}</span>}
      </div>

      <p className="text-xs text-slate-600">{strings.paramsCaption}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span>{format(strings.xLabel, { n: formatDK(x, 1) })}</span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={x}
          disabled={paused}
          onChange={(e) => setX(Number(e.target.value))}
          aria-label="X"
        />
      </label>

      <div className="text-sm font-mono">{format(strings.yReadout, { n: formatDK(y, 2) })}</div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          disabled={paused}
          onClick={record}
          className="px-3 py-2 rounded bg-navy text-white hover:opacity-90 disabled:opacity-50"
        >
          {strings.addMeasurement}
        </button>
        <span className="text-slate-600">
          {format(strings.measurementCount, { n: measurements.length })}
        </span>
      </div>

      <div>
        <button
          type="button"
          disabled={paused || reviewed}
          onClick={markReviewed}
          className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-sm"
        >
          {strings.markReviewed}
        </button>
        {reviewed && (
          <span className="ml-2 text-sm text-green-700">{strings.reviewedConfirmation}</span>
        )}
      </div>
    </div>
  );
}

export { meta };

export const gates = {
  'wide-range': (state: unknown) => {
    const s = state as ReferenceSimState | null;
    return s ? coverWideRange(s.measurements) : false;
  },
};
