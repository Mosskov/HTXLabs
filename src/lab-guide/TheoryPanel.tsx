// Collapsible theory block (default collapsed) — controlled by ExperimentRoute so the choice survives the landing↔guide subtree swap.
import { TheoryClosed } from '@/icons/TheoryClosed';
import { TheoryOpen } from '@/icons/TheoryOpen';
import type { ReactNode } from 'react';
import { strings } from './strings.da';

export function TheoryPanel({
  children,
  open,
  onToggle,
}: { children: ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={onToggle}
        className="w-full h-12 flex items-center gap-2 px-4 text-left text-base font-medium text-navy rounded-md no-print border-2 border-accent-400 bg-white hover:bg-accent-50 transition-colors"
        aria-expanded={open}
      >
        {open ? <TheoryOpen className="w-8 h-8" /> : <TheoryClosed className="w-8 h-8" />}
        <span>{strings.guide.theoryLabel}</span>
      </button>
      <div className={`${open ? 'mt-4 px-4' : 'hidden'} print:!block print:mt-0 print:px-0`}>
        <div className="prose max-w-none">{children}</div>
      </div>
    </section>
  );
}
