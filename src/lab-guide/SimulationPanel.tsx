import { type ReactNode, useState } from 'react';
import { strings } from './strings.da';

/**
 * Collapsible card that hosts the simulation. Per spec §17, the simulation
 * is mounted ONCE for the lifetime of the lab page — only its visibility
 * toggles when the student clicks "Skjul simulation". State survives.
 */
export function SimulationPanel({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <section className="lab-card mb-8 no-print">
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-navy hover:bg-slate-50 rounded-t-lg"
        aria-expanded={!hidden}
      >
        <span aria-hidden className="text-slate-500">
          {hidden ? '▶' : '▼'}
        </span>
        <span>{hidden ? strings.guide.showSimulation : strings.guide.hideSimulation}</span>
      </button>
      <div className={hidden ? 'hidden' : 'p-4'}>{children}</div>
    </section>
  );
}
