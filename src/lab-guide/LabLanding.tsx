// Lab landing page rendered before the student picks an inquiry mode: header + meta chips + theory/sim disclosures + ModePicker.
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import { type ComponentType, type ReactNode, useState } from 'react';
import { ModePicker } from './ModePicker';
import { ResetWorkButton } from './ResetWorkButton';
import { SimulationPanel } from './SimulationPanel';
import { TheoryPanel } from './TheoryPanel';
import { TopicBackLink } from './TopicBackLink';
import { type Mode, load, wipe } from './runner';
import { format, strings } from './strings.da';

interface LabLandingProps {
  experiment: ExperimentFrontmatter;
  topic: string;
  topicTitle: string;
  slug: string;
  theory: ReactNode;
  simulation?: SimulationModule;
  onSelectMode: (mode: Mode) => void;
  /** Route-level view reset — collapses theory + sim disclosures after a wipe
   *  so a "Nulstil lab" press from the landing reads as a fresh visit. */
  onResetView?: () => void;
  theoryOpen: boolean;
  onToggleTheory: () => void;
  simOpen: boolean;
  onToggleSim: () => void;
}

const noop = () => {};

export function LabLanding({
  experiment,
  topic,
  topicTitle,
  slug,
  theory,
  simulation,
  onSelectMode,
  onResetView,
  theoryOpen,
  onToggleTheory,
  simOpen,
  onToggleSim,
}: LabLandingProps) {
  const Sim: ComponentType<import('@/sim-contract').SimulationProps> | undefined =
    simulation?.default;
  const meta = simulation?.meta;
  const initialParams = {
    ...(meta?.defaultParams ?? {}),
    ...(experiment.simulationOverrides?.defaultParams ?? {}),
  };

  const experimentId = `${topic}/${slug}`;
  // Bumped after a wipe to force a re-render so the fresh load() result flows
  // back down to ModePicker (which has no localStorage read of its own).
  const [resetTick, setResetTick] = useState(0);
  const saved = load(experimentId);
  const hasSavedState = saved !== null;

  return (
    <article className="space-y-8">
      <header>
        <TopicBackLink topicSlug={topic} topicTitle={topicTitle} />
        <h1 className="lab-heading text-3xl sm:text-4xl text-navy font-bold">{experiment.title}</h1>
        {experiment.learningObjectives[0] && (
          <p className="mt-2 text-base text-slate-600">{experiment.learningObjectives[0]}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
            {strings.landing.levelChip[experiment.difficulty]}
          </span>
          {experiment.estimatedMinutes !== undefined && (
            <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
              {format(strings.landing.durationChip, { minutes: experiment.estimatedMinutes })}
            </span>
          )}
        </div>
      </header>

      <TheoryPanel open={theoryOpen} onToggle={onToggleTheory}>
        {theory}
      </TheoryPanel>

      {Sim && meta && (
        <SimulationPanel open={simOpen} onToggle={onToggleSim}>
          <Sim
            width={520}
            height={420}
            initialParams={initialParams}
            onProgress={noop}
            onState={noop}
          />
        </SimulationPanel>
      )}

      <ModePicker
        key={resetTick}
        experiment={experiment}
        experimentId={experimentId}
        saved={saved}
        onSelect={onSelectMode}
      />

      {hasSavedState && (
        <ResetWorkButton
          onConfirm={() => {
            wipe(experimentId);
            setResetTick((t) => t + 1);
            onResetView?.();
          }}
        />
      )}
    </article>
  );
}
