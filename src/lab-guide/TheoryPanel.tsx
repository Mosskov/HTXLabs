// Collapsible theory block (default collapsed) — chevron-toggle reveals Formål, Teori, etc.
import { type ReactNode, useState } from 'react';
import { strings } from './strings.da';

export function TheoryPanel({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-base font-medium text-navy border border-slate-200 hover:bg-slate-50 rounded-md no-print"
        aria-expanded={!hidden}
      >
        <span aria-hidden className="text-slate-500">
          {hidden ? '▶' : '▼'}
        </span>
        <span>{hidden ? strings.guide.showTheory : strings.guide.hideTheory}</span>
      </button>
      <div className={`${hidden ? 'hidden' : 'mt-4 px-4'} print:!block print:mt-0 print:px-0`}>
        <div className="prose max-w-none">{children}</div>
      </div>
    </section>
  );
}
