import { SimulationClosed } from '@/icons/SimulationClosed';
import { SimulationOpen } from '@/icons/SimulationOpen';
import { type ReactNode, useState } from 'react';
import { strings } from './strings.da';

/**
 * Collapsible host for the simulation. Per spec §17, the simulation is mounted
 * ONCE for the lifetime of the lab page — only its visibility toggles when the
 * student clicks the header. State survives.
 *
 * `initialOpen` defaults to true (LabGuide context — sim is the active tool).
 * Landing page passes `false` to keep the screenshot's calm preview state.
 */
export function SimulationPanel({
  children,
  initialOpen = true,
}: { children: ReactNode; initialOpen?: boolean }) {
  const [hidden, setHidden] = useState(!initialOpen);

  return (
    <section className="mb-8 no-print">
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="w-full h-12 flex items-center gap-2 px-4 text-left text-base font-medium text-navy rounded-md border-2 border-accent-400 bg-white hover:bg-accent-50 transition-colors"
        aria-expanded={!hidden}
      >
        {hidden ? <SimulationClosed className="w-8 h-8" /> : <SimulationOpen className="w-8 h-8" />}
        <span>{strings.guide.simulationLabel}</span>
      </button>
      <div className={hidden ? 'hidden' : 'mt-4 px-4'}>{children}</div>
    </section>
  );
}
