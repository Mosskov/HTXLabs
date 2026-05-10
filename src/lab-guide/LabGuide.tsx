import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { ComponentType, ReactNode } from 'react';
import { PhaseFooter } from './PhaseFooter';
import { PhaseStepper } from './PhaseStepper';
import { RunnerProvider, useRunner } from './RunnerContext';
import { SimulationPanel } from './SimulationPanel';
import type { Mode } from './runner';
import { strings } from './strings.da';
import { GateDebug } from './widgets/GateDebug';
import { ToastProvider } from './widgets/ToastContext';

interface LabGuideProps {
  experiment: ExperimentFrontmatter;
  /** Folder slug for the experiment — uniquely identifies the lab within its
   * topic. Used as the localStorage key suffix; do not derive from frontmatter
   * (`simulationId` collides for theory-only labs that share `'__none'`). */
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
  const { experiment, slug, mode = 'guided', simulation } = props;
  const phases = experiment.modes[mode]?.phases ?? experiment.modes.guided.phases;

  return (
    <ToastProvider>
      <RunnerProvider
        experimentId={`${experiment.topic}/${slug}`}
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
        <h1 className="text-3xl text-navy mb-2">{experiment.title}</h1>
      </header>

      {showGateDebug && <GateDebug />}

      <section className="prose max-w-prose">{theory}</section>

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
        <h2 className="lab-heading text-2xl mb-4">{strings.guide.heading}</h2>
        <PhaseStepper phases={phases} />
        {currentPhase?.intro && (
          <div className="instruction-box mb-6 whitespace-pre-line">{currentPhase.intro}</div>
        )}
        <div className="prose max-w-none">
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
