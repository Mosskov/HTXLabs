// Three-card mode selector shown on the lab landing page before the student picks an inquiry mode.
import type { ExperimentFrontmatter } from '@/lib/schema';
import { type Mode, load } from './runner';
import { strings } from './strings.da';

const MODE_ORDER: Mode[] = ['guided', 'semi-guided', 'open'];

interface ModePickerProps {
  experiment: ExperimentFrontmatter;
  /** Persistence key — same `${topic}/${slug}` shape used by RunnerProvider so the
   * "Fortsæt" affordance reads the actual saved state. */
  experimentId: string;
  onSelect: (mode: Mode) => void;
}

export function ModePicker({ experiment, experimentId, onSelect }: ModePickerProps) {
  const saved = load(experimentId);
  // "Fortsæt" only when there's saved progress past the first phase of the saved mode.
  const continueMode: Mode | null = (() => {
    if (!saved) return null;
    const savedPhases = experiment.modes[saved.mode]?.phases;
    const firstPhase = savedPhases?.[0];
    if (!firstPhase) return null;
    if (saved.currentPhaseId === firstPhase.id && saved.visitedPhaseIds.size <= 1) return null;
    return saved.mode;
  })();

  return (
    <section className="mt-4">
      <h2 className="lab-heading text-xl mb-4">{strings.landing.heading}</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {MODE_ORDER.map((mode) => {
          const declared = !!experiment.modes[mode];
          const isContinue = continueMode === mode;
          const card = strings.landing.modeCards[mode];
          return (
            <li key={mode}>
              <button
                type="button"
                onClick={() => declared && onSelect(mode)}
                disabled={!declared}
                aria-label={card.title}
                className={[
                  'w-full h-full text-left rounded-md border-2 px-4 py-3 transition-colors',
                  declared
                    ? 'border-accent-400 bg-white hover:bg-accent-50 cursor-pointer'
                    : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-semibold ${declared ? 'text-slate-700' : 'text-slate-400'}`}
                  >
                    {card.title}
                  </span>
                  {declared && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 bg-accent-50 px-2 py-0.5 rounded">
                      {isContinue ? strings.landing.continueLabel : strings.landing.startLabel}
                      <span aria-hidden>→</span>
                    </span>
                  )}
                </div>
                <p className={`text-sm mt-1 ${declared ? 'text-slate-700' : 'text-slate-400'}`}>
                  {declared ? card.description : strings.landing.unavailableHint}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
