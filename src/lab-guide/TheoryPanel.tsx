// Collapsible card hosting the theory blocks — mirrors SimulationPanel, default collapsed.
import { type ReactNode, useState } from 'react';
import { strings } from './strings.da';

export function TheoryPanel({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);

  return (
    <section className="lab-card mb-8">
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium text-navy hover:bg-slate-50 rounded-t-lg no-print"
        aria-expanded={!hidden}
      >
        <span aria-hidden className="text-slate-500">
          {hidden ? '▶' : '▼'}
        </span>
        <span>{hidden ? strings.guide.showTheory : strings.guide.hideTheory}</span>
      </button>
      <div className={`${hidden ? 'hidden' : 'p-4'} print:!block print:p-0`}>
        <div className="prose max-w-prose">{children}</div>
      </div>
    </section>
  );
}
