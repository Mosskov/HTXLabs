// Top-level lab page: theory + simulation panel + gated phase flow.
import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { ComponentType, ReactNode } from 'react';
import { InstructionBox } from './InstructionBox';
import { LabBreadcrumb } from './LabBreadcrumb';
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
  /** Display title for the topic (e.g. "Mekanik") — used by the eyebrow
   * back-link. Resolved from topic frontmatter in the route layer. */
  topicTitle: string;
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
  /** Invoked from the first phase's "Skift undersøgelsesform" affordance —
   * route strips `?mode=` to bounce back to the lab landing / mode picker. */
  onSwitchInquiryForm?: () => void;
  /** Invoked from "Nulstil lab" confirm — drops `?mode=` AND collapses theory
   * + sim disclosures so the post-reset landing reads as a fresh visit. */
  onResetView?: () => void;
  /** Theory disclosure state — hoisted to ExperimentRoute so the open/closed
   * choice survives the landing↔guide subtree swap. */
  theoryOpen: boolean;
  onToggleTheory: () => void;
  /** Simulation disclosure state — same rationale as theoryOpen. */
  simOpen: boolean;
  onToggleSim: () => void;
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
  topic,
  topicTitle,
  slug,
  mode = 'guided',
  theory,
  phaseBodies,
  simulation,
  phases,
  onSwitchInquiryForm,
  onResetView,
  theoryOpen,
  onToggleTheory,
  simOpen,
  onToggleSim,
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
        <LabBreadcrumb
          topicSlug={topic}
          topicTitle={topicTitle}
          labSlug={slug}
          labTitle={experiment.title}
          mode={mode}
        />
      </header>

      {showGateDebug && <GateDebug />}

      <TheoryPanel open={theoryOpen} onToggle={onToggleTheory}>
        {theory}
      </TheoryPanel>

      {Sim && meta && (
        <SimulationPanel open={simOpen} onToggle={onToggleSim}>
          <Sim
            key={resetKey}
            width={520}
            height={420}
            initialParams={initialParams}
            initialState={state.simulationState}
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
          <InstructionBox phase={currentPhase} phaseNumber={phases.indexOf(currentPhase) + 1} />
        )}
        <div className="prose max-w-none px-4 text-sm">
          {phases.map((p) => (
            <section key={p.id} hidden={p.id !== state.currentPhaseId}>
              {phaseBodies[p.id]}
            </section>
          ))}
        </div>
        <PhaseFooter
          phases={phases}
          onSwitchInquiryForm={onSwitchInquiryForm}
          onResetView={onResetView}
        />
      </section>
    </article>
  );
}
