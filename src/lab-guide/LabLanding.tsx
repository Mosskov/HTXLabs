// Lab landing page rendered before the student picks an inquiry mode: header + meta chips + theory/sim disclosures + ModePicker.
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import type { ComponentType, ReactNode } from 'react';
import { ModePicker } from './ModePicker';
import { SimulationPanel } from './SimulationPanel';
import { TheoryPanel } from './TheoryPanel';
import type { Mode } from './runner';
import { format, strings } from './strings.da';

interface LabLandingProps {
  experiment: ExperimentFrontmatter;
  topic: string;
  slug: string;
  theory: ReactNode;
  simulation?: SimulationModule;
  onSelectMode: (mode: Mode) => void;
}

const noop = () => {};

export function LabLanding({
  experiment,
  topic,
  slug,
  theory,
  simulation,
  onSelectMode,
}: LabLandingProps) {
  const Sim: ComponentType<import('@/sim-contract').SimulationProps> | undefined =
    simulation?.default;
  const meta = simulation?.meta;
  const initialParams = {
    ...(meta?.defaultParams ?? {}),
    ...(experiment.simulationOverrides?.defaultParams ?? {}),
  };

  return (
    <article className="space-y-8">
      <header>
        <p className="text-xs font-semibold tracking-widest text-accent mb-2">
          {strings.eyebrow.experiment}
        </p>
        <h1 className="lab-heading text-3xl sm:text-4xl text-navy font-bold">{experiment.title}</h1>
        {experiment.learningObjectives[0] && (
          <p className="mt-2 text-base text-slate-600">{experiment.learningObjectives[0]}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center text-xs font-medium text-accent bg-accent-100 border border-accent-200 px-2 py-0.5 rounded">
            {strings.landing.levelChip[experiment.difficulty]}
          </span>
          {experiment.estimatedMinutes !== undefined && (
            <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
              {format(strings.landing.durationChip, { minutes: experiment.estimatedMinutes })}
            </span>
          )}
        </div>
      </header>

      <TheoryPanel>{theory}</TheoryPanel>

      {Sim && meta && (
        <SimulationPanel initialOpen={false}>
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
        experiment={experiment}
        experimentId={`${topic}/${slug}`}
        onSelect={onSelectMode}
      />
    </article>
  );
}
