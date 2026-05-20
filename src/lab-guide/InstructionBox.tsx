// Instruction-box card: the phase checklist above a phase body. Renders
// `intro` as a plain sentence, string-only `steps` as the legacy lettered
// list, and object-form `steps` as a circle progress tracker reflecting each
// step's completion read live from the widget registry.
import type { Phase, PhaseStep } from '@/lib/schema';
import { useRunner } from './RunnerContext';
import { Tooltip } from './Tooltip';
import { type GateCtx, widgetSatisfied } from './gates';
import { strings } from './strings.da';

type NormalizedStep = PhaseStep;
type StepState = 'done' | 'locked' | 'active';

function normalize(step: string | PhaseStep): NormalizedStep {
  return typeof step === 'string' ? { text: step } : step;
}

/** Project one step to its tracker state. A section target reads the parent
 *  table's per-section facet and never locks (the table is always on the
 *  page). A whole-widget target is `locked` while its widget is absent from
 *  the registry — which is exactly how `<RevealWhen>` + `clearOnHide` leave a
 *  not-yet-revealed widget — and `done` once its widget is satisfied. A
 *  `kind:'filled'` widget that publishes `correct` (has an `expected` config)
 *  must be correct to read `done`; a presence-only `filled` widget (no
 *  `correct` facet — e.g. FreeTextResponse, DataTable) is `done` once filled,
 *  since a strict projection would leave it active forever. */
function stepState(step: NormalizedStep, gateCtx: GateCtx): StepState {
  if (step.widgetId) {
    const w = gateCtx.widgets[step.widgetId];
    if (step.section) {
      return w?.kind === 'filled' && w.sections?.[step.section] ? 'done' : 'active';
    }
    if (w === undefined) return 'locked';
    const requireCorrect = !(w.kind === 'filled' && w.correct === undefined);
    if (widgetSatisfied(w, requireCorrect)) return 'done';
  }
  return 'active';
}

export function InstructionBox({ phase, phaseNumber }: { phase: Phase; phaseNumber: number }) {
  const { gateCtx } = useRunner();

  // `intro` is the legacy one-sentence opt-out — no header, no list.
  if (!phase.steps) {
    return phase.intro ? (
      <div className="instruction-box mx-4 mb-6 text-sm">
        <span className="whitespace-pre-line">{phase.intro}</span>
      </div>
    ) : null;
  }

  const steps = phase.steps.map(normalize);
  const tracked = steps.some((s) => s.widgetId !== undefined);

  return (
    <div className="instruction-box mx-4 mb-6 text-sm">
      <p className="font-semibold text-slate-900 mb-2">
        Fase {phaseNumber} – {phase.title}:
      </p>
      {tracked ? (
        <ul className="space-y-1.5">
          {steps.map((s) => (
            <StepRow key={s.text} step={s} state={stepState(s, gateCtx)} />
          ))}
        </ul>
      ) : steps.length === 1 ? (
        <p>{steps[0]?.text}</p>
      ) : (
        <ol className="list-[lower-alpha] pl-6 space-y-1">
          {steps.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** One tracked step: a state circle (mirrors PhaseStepper's circle visual,
 *  scaled down) + the step text. The circle + ✓ are decorative; the state is
 *  conveyed to assistive tech via a visually-hidden suffix. */
function StepRow({ step, state }: { step: NormalizedStep; state: StepState }) {
  const circleClass =
    state === 'done'
      ? 'bg-accent-100 border-accent-400 text-accent'
      : state === 'active'
        ? 'bg-white border-accent-400 text-accent'
        : 'bg-slate-100 border-slate-300 text-slate-400';
  const textClass =
    state === 'done' ? 'text-slate-500' : state === 'locked' ? 'text-slate-400' : 'text-slate-900';
  const suffix =
    state === 'done'
      ? strings.instructionBox.stepDone
      : state === 'locked'
        ? strings.instructionBox.stepLocked
        : '';

  const textNode = (
    <span className={textClass}>
      {step.text}
      {suffix && <span className="sr-only">{suffix}</span>}
    </span>
  );

  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-medium ${circleClass}`}
      >
        {state === 'done' ? '✓' : ''}
      </span>
      {state === 'locked' ? (
        <Tooltip content={step.lockedHint ?? strings.instructionBox.stepLockedHint}>
          {textNode}
        </Tooltip>
      ) : (
        textNode
      )}
    </li>
  );
}
