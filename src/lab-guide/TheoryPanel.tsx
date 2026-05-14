// Collapsible theory block (default collapsed) — icon-led toggle reveals Formål, Teori, etc.
import { TheoryClosed } from '@/icons/TheoryClosed';
import { TheoryOpen } from '@/icons/TheoryOpen';
import { type ReactNode, useState } from 'react';
import { strings } from './strings.da';

export function TheoryPanel({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(true);

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setHidden((h) => !h)}
        className="w-full h-12 flex items-center gap-2 px-4 text-left text-base font-medium text-navy rounded-md no-print border-2 border-accent-400 bg-white hover:bg-accent-50 transition-colors"
        aria-expanded={!hidden}
      >
        {hidden ? <TheoryClosed className="w-8 h-8" /> : <TheoryOpen className="w-8 h-8" />}
        <span>{strings.guide.theoryLabel}</span>
      </button>
      <div className={`${hidden ? 'hidden' : 'mt-4 px-4'} print:!block print:mt-0 print:px-0`}>
        <div className="prose max-w-none">{children}</div>
      </div>
    </section>
  );
}
