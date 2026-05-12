// Top-level lab page: theory + simulation panel + gated phase flow.
import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { ComponentType, ReactNode } from 'react';
import { PhaseFooter } from './PhaseFooter';
import { PhaseStepper } from './PhaseStepper';
import { RunnerProvider, useRunner } from './RunnerContext';
import { SimulationPanel } from './SimulationPanel';
import { TheoryPanel } from './TheoryPanel';
import { GateDebug } from './dev/GateDebug';
import type { Mode } from './runner';
import { strings } from './strings.da';
import { ToastProvider } from './widgets/ToastContext';

interface LabGuideProps {
  experiment: ExperimentFrontmatter;
  /** Folder slug for the topic this lab belongs to — paired with `slug` to
   * form the persistence key. Path-derived in routes; tests pass it directly. */
  topic: string;
  /** Folder slug for the experiment — uniquely identifies the lab within its
   * topic. Used as the localStorage key suffix; do not derive from frontmatter
   * (`simulationId` collides for theory-only labs that share `NO_SIMULATION`). */
  slug: string;
  /** Inquiry mode (URL-driven via `?mode=`). Falls back to `'guided'` when the
   * lab doesn't declare phases for the requested mode — gates auto-loosen for
   * `'open'` via `inquiryFreeAdvance` in `gates.ts`. */
  mode?: Mode;
  /** MDX content above the guide — Formål, Centrale begreber, Nøgleligning, Teori. */
  theory: ReactNode;
  /** Map of phase id → MDX-rendered body. */
  phaseBodies: Record<string, ReactNode>;
  /** Resolved simulation module, or undefined for labs with no simulation. */
  simulation?: SimulationModule;
}

export function LabGuide(props: LabGuideProps) {
  const { experiment, topic, slug, mode = 'guided', simulation } = props;
  const requestedPhases = experiment.modes[mode]?.phases;
  if (!requestedPhases && mode !== 'guided') {
    console.info(
      `[htxlabs] mode '${mode}' not declared by ${topic}/${slug} — falling back to guided.`,
    );
  }
  const phases = requestedPhases ?? experiment.modes.guided.phases;

  return (
    <ToastProvider>
      <RunnerProvider
        experimentId={`${topic}/${slug}`}
        experimentVersion={experiment.version}
        phases={phases}
        simulation={simulation}
        initialMode={mode}
      >
        <LabGuideInner {...props} phases={phases} />
      </RunnerProvider>
    </ToastProvider>
  );
}

function LabGuideInner({
  experiment,
  theory,
  phaseBodies,
  simulation,
  phases,
}: LabGuideProps & { phases: Phase[] }) {
  const { state, onSimulationProgress, setSimulationState, resetKey } = useRunner();
  const Sim: ComponentType<import('@/sim-contract').SimulationProps> | undefined =
    simulation?.default;
  const meta = simulation?.meta;
  const overrides = experiment.simulationOverrides;
  const initialParams = {
    ...(meta?.defaultParams ?? {}),
    ...(overrides?.defaultParams ?? {}),
  };

  const currentPhase = phases.find((p) => p.id === state.currentPhaseId);
  const showGateDebug = import.meta.env.DEV && experiment.tags?.includes('test');

  return (
    <article className="space-y-8">
      <header>
        <p className="text-xs font-semibold tracking-widest text-accent mb-2">
          {strings.eyebrow.lab}
        </p>
        <h1 className="lab-heading text-3xl sm:text-4xl text-navy font-bold">{experiment.title}</h1>
      </header>

      {showGateDebug && <GateDebug />}

      <TheoryPanel>{theory}</TheoryPanel>

      {Sim && meta && (
        <SimulationPanel>
          <Sim
            key={resetKey}
            width={520}
            height={420}
            initialParams={initialParams}
            onProgress={onSimulationProgress}
            onState={setSimulationState}
          />
        </SimulationPanel>
      )}

      <section data-print-include="true">
        <h2 className="lab-heading text-xl mb-4">{strings.guide.heading}</h2>
        <div className="sticky top-0 z-10 bg-slate-50 pt-2 pb-3 -mx-4 px-4 no-print">
          <PhaseStepper phases={phases} />
        </div>
        {currentPhase && (currentPhase.steps || currentPhase.intro) && (
          <div className="instruction-box mx-4 mb-6 text-sm">
            {currentPhase.steps ? (
              <>
                <p className="font-semibold text-slate-900 mb-2">
                  Fase {phases.indexOf(currentPhase) + 1} – {currentPhase.title}:
                </p>
                {currentPhase.steps.length === 1 ? (
                  <p>{currentPhase.steps[0]}</p>
                ) : (
                  <ol className="list-[lower-alpha] pl-6 space-y-1">
                    {currentPhase.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <span className="whitespace-pre-line">{currentPhase.intro}</span>
            )}
          </div>
        )}
        <div className="prose max-w-none px-4 text-sm">
          {phases.map((p) => (
            <section key={p.id} hidden={p.id !== state.currentPhaseId}>
              {phaseBodies[p.id]}
            </section>
          ))}
        </div>
        <PhaseFooter phases={phases} />
      </section>
    </article>
  );
}
