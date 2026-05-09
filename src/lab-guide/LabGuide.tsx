import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { ComponentType, ReactNode } from 'react';
import { PhaseFooter } from './PhaseFooter';
import { PhaseStepper } from './PhaseStepper';
import { RunnerProvider, useRunner } from './RunnerContext';
import { SimulationPanel } from './SimulationPanel';
import { strings } from './strings.da';
import { ToastProvider } from './widgets/ToastContext';

interface LabGuideProps {
  experiment: ExperimentFrontmatter;
  /** MDX content above the guide — Formål, Centrale begreber, Nøgleligning, Teori. */
  theory: ReactNode;
  /** Map of phase id → MDX-rendered body. */
  phaseBodies: Record<string, ReactNode>;
  /** Resolved simulation module, or undefined for labs with no simulation. */
  simulation?: SimulationModule;
}

export function LabGuide(props: LabGuideProps) {
  const { experiment } = props;
  const phases = experiment.modes.guided.phases;

  return (
    <ToastProvider>
      <RunnerProvider
        experimentId={`${experiment.topic}/${experiment.simulationId}`}
        experimentVersion={experiment.version}
        phases={phases}
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
  const { state, onSimulationProgress } = useRunner();
  const Sim: ComponentType<import('@/sim-contract').SimulationProps> | undefined =
    simulation?.default;
  const meta = simulation?.meta;
  const overrides = experiment.simulationOverrides;
  const initialParams = {
    ...(meta?.defaultParams ?? {}),
    ...(overrides?.defaultParams ?? {}),
  };

  const currentPhase = phases.find((p) => p.id === state.currentPhaseId);

  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-3xl text-navy mb-2">{experiment.title}</h1>
      </header>

      <section className="prose max-w-prose">{theory}</section>

      {Sim && meta && (
        <SimulationPanel>
          <Sim
            width={520}
            height={420}
            initialParams={initialParams}
            onProgress={onSimulationProgress}
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
