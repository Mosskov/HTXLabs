// Three-card mode selector shown on the lab landing page before the student picks an inquiry mode.
import type { ExperimentFrontmatter } from '@/lib/schema';
import { type Mode, type RunnerState, load, wipe } from './runner';
import { format, strings } from './strings.da';

const MODE_ORDER: Mode[] = ['guided', 'semi-guided', 'open'];

interface ModePickerProps {
  experiment: ExperimentFrontmatter;
  /** Persistence key — same `${topic}/${slug}` shape used by RunnerProvider so the
   * "Fortsæt" affordance reads the actual saved state. */
  experimentId: string;
  onSelect: (mode: Mode) => void;
}

/** Saved progress is "meaningful" — and so worth a confirm dialog before wiping —
 * when the student is past the first phase of the saved mode, or has stored
 * any widget values (typing in phase 1 inputs without advancing still counts). */
function hasMeaningfulProgress(saved: RunnerState, experiment: ExperimentFrontmatter): boolean {
  const savedPhases = experiment.modes[saved.mode]?.phases;
  const firstPhase = savedPhases?.[0];
  if (!firstPhase) return false;
  const pastFirstPhase = saved.currentPhaseId !== firstPhase.id || saved.visitedPhaseIds.size > 1;
  const hasWidgetValues = Object.keys(saved.widgetValues).length > 0;
  return pastFirstPhase || hasWidgetValues;
}

export function ModePicker({ experiment, experimentId, onSelect }: ModePickerProps) {
  const saved = load(experimentId);
  // "Fortsæt" surfaces whenever the saved state is meaningful — same threshold
  // used for the wipe-warning, so the label can't lie about what the student
  // is about to discard by clicking a different mode.
  const continueMode: Mode | null =
    saved && hasMeaningfulProgress(saved, experiment) ? saved.mode : null;

  function handleSelect(mode: Mode) {
    // Same mode as the saved one (or no saved state): nothing to discard.
    if (!saved || saved.mode === mode) {
      onSelect(mode);
      return;
    }
    if (hasMeaningfulProgress(saved, experiment)) {
      const ok = window.confirm(
        format(strings.landing.confirmModeSwitch, {
          current: strings.modes[saved.mode],
          next: strings.modes[mode],
        }),
      );
      if (!ok) return;
    }
    // Different mode + (confirmed or trivial state): wipe before re-entering
    // so the new mode starts from emptyState rather than inheriting the old.
    wipe(experimentId);
    onSelect(mode);
  }

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
                onClick={() => declared && handleSelect(mode)}
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
