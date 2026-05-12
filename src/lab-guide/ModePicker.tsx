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
      <h2 className="lab-heading text-xl mb-1">{strings.landing.heading}</h2>
      <p className="text-sm text-slate-600 mb-4">{strings.landing.subheading}</p>
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
                  'w-full h-full text-left rounded-md border px-4 py-3 transition',
                  declared
                    ? 'border-slate-200 bg-white hover:border-accent-400 hover:bg-accent-50 cursor-pointer'
                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-semibold ${declared ? 'text-accent' : 'text-slate-400'}`}>
                    {card.title}
                  </span>
                  {isContinue && (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-accent bg-accent-100 px-2 py-0.5 rounded">
                      {strings.landing.continueLabel}
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
