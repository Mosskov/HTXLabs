import { SimulationClosed } from '@/icons/SimulationClosed';
import { SimulationOpen } from '@/icons/SimulationOpen';
import type { ReactNode } from 'react';
import { strings } from './strings.da';

/**
 * Collapsible host for the simulation. Per spec §17, the simulation is mounted
 * ONCE for the lifetime of the lab page — only its visibility toggles when the
 * student clicks the header. State survives.
 *
 * Controlled: `open` + `onToggle` are owned by `ExperimentRoute` so the choice
 * survives the landing↔guide subtree swap.
 */
export function SimulationPanel({
  children,
  open,
  onToggle,
}: { children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <section className="mb-8 no-print">
      <button
        type="button"
        onClick={onToggle}
        className="w-full h-12 flex items-center gap-2 px-4 text-left text-base font-medium text-navy rounded-md border-2 border-accent-400 bg-white hover:bg-accent-50 transition-colors"
        aria-expanded={open}
      >
        {open ? <SimulationOpen className="w-8 h-8" /> : <SimulationClosed className="w-8 h-8" />}
        <span>{strings.guide.simulationLabel}</span>
      </button>
      <div className={open ? 'mt-4 px-4' : 'hidden'}>{children}</div>
    </section>
  );
}
