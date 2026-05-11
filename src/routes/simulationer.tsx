// Standalone sim playground: pick a sim id, drive its props, watch ProgressEvents.
import { format, strings } from '@/lab-guide/strings.da';
import { loadSimulation, simulationRegistry } from '@/lib/simulations';
import {
  type ParamSchemaEntry,
  type ProgressEvent,
  type SimulationModule,
  simTitleDa,
} from '@/sim-contract';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export function SimulationerIndex() {
  const ids = Object.keys(simulationRegistry).sort();
  return (
    <section>
      <h1 className="lab-heading">{strings.simulationer.title}</h1>
      <p className="text-slate-600 mb-4">{strings.simulationer.indexIntro}</p>
      {ids.length === 0 ? (
        <p>{strings.simulationer.noSimulations}</p>
      ) : (
        <ul className="list-disc pl-6">
          {ids.map((id) => (
            <li key={id}>
              <Link to={`/simulationer/${id}`} className="text-accent hover:underline">
                {id}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SimulationerRoute() {
  const { simId } = useParams();
  const [module, setModule] = useState<SimulationModule | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!simId) {
      setModule(null);
      return;
    }
    loadSimulation(simId).then((mod) => {
      if (!cancelled) setModule(mod ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [simId]);

  if (module === undefined) {
    return <p className="text-slate-600">{strings.simulationer.loading}</p>;
  }
  if (module === null) {
    return (
      <p className="text-slate-600">
        {format(strings.simulationer.unknownSim, { id: simId ?? '' })}
      </p>
    );
  }

  return <SimulationerHarness module={module} simId={simId ?? ''} />;
}

function SimulationerHarness({
  module,
  simId,
}: {
  module: SimulationModule;
  simId: string;
}) {
  const { meta, default: SimComponent } = module;
  const [params, setParams] = useState<Record<string, number | string>>({
    ...meta.defaultParams,
  });
  const [paused, setPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [events, setEvents] = useState<Array<{ id: number; event: ProgressEvent }>>([]);
  const eventIdRef = useRef(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleReset = () => {
    setParams({ ...meta.defaultParams });
    setEvents([]);
    setResetKey((k) => k + 1);
  };

  const handleProgress = (e: ProgressEvent) => {
    eventIdRef.current += 1;
    const id = eventIdRef.current;
    setEvents((prev) => [...prev, { id, event: e }]);
  };

  const updateParam = (key: string, value: number | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section>
      <header className="mb-4">
        <h1 className="lab-heading">
          {format(strings.simulationer.titleWithSim, { title: simTitleDa(meta) })}
        </h1>
        <p className="text-sm text-slate-500">
          <code>{simId}</code>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 mb-4">
        <div
          ref={wrapperRef}
          className="border border-slate-200 rounded bg-white min-h-[400px] flex items-center justify-center overflow-hidden"
        >
          {size ? (
            <SimComponent
              key={resetKey}
              width={size.width}
              height={size.height}
              initialParams={params}
              paused={paused}
              onProgress={handleProgress}
            />
          ) : (
            <span className="text-slate-400 text-sm">{strings.simulationer.measuringSize}</span>
          )}
        </div>

        <aside className="border border-slate-200 rounded bg-white p-4 space-y-4">
          <div>
            <h2 className="font-semibold text-navy mb-2">{strings.simulationer.params}</h2>
            <div className="space-y-3">
              {Object.entries(meta.paramSchema).map(([key, entry]) => (
                <ParamControl
                  key={key}
                  name={key}
                  entry={entry}
                  value={params[key] ?? meta.defaultParams[key] ?? ''}
                  onChange={(v) => updateParam(key, v)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={paused}
                onChange={(e) => setPaused(e.target.checked)}
              />
              {strings.simulationer.pause}
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm rounded bg-slate-100 hover:bg-slate-200 px-3 py-1.5"
            >
              {strings.simulationer.reset}
            </button>
          </div>
        </aside>
      </div>

      <div className="border border-slate-200 rounded bg-white">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
          <h2 className="font-semibold text-navy">
            {format(strings.simulationer.eventLog, { n: events.length })}
          </h2>
          <button
            type="button"
            onClick={() => setEvents([])}
            className="text-sm text-slate-600 hover:text-accent"
          >
            {strings.simulationer.clearLog}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-4 font-mono text-xs space-y-1">
          {events.length === 0 ? (
            <p className="text-slate-400">{strings.simulationer.noEvents}</p>
          ) : (
            events.map(({ id, event }) => (
              <div key={id} className="text-slate-700">
                <span className="text-accent">{event.type}</span> {formatPayload(event)}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ParamControl({
  name,
  entry,
  value,
  onChange,
}: {
  name: string;
  entry: ParamSchemaEntry;
  value: number | string;
  onChange: (v: number | string) => void;
}) {
  if (entry.type === 'range') {
    const numValue = typeof value === 'number' ? value : Number(value);
    return (
      <label className="block text-sm">
        <div className="flex justify-between mb-1">
          <span className="font-medium">{name}</span>
          <span className="text-slate-500">
            {numValue} {entry.unit}
          </span>
        </div>
        <input
          type="range"
          min={entry.min}
          max={entry.max}
          step={entry.step}
          value={numValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full"
        />
      </label>
    );
  }
  return (
    <label className="block text-sm">
      <div className="font-medium mb-1">{name}</div>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1"
      >
        {entry.values.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatPayload(e: ProgressEvent): string {
  if (e.type === 'milestone') {
    return e.payload === undefined ? e.id : `${e.id} ${JSON.stringify(e.payload)}`;
  }
  if (e.type === 'data-collected') {
    return `count=${e.count}`;
  }
  return '';
}
