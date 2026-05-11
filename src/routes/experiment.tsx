// Experiment route: loads an experiment + its sim, mounts a LabGuide.
import { LabGuide } from '@/lab-guide/LabGuide';
import { strings } from '@/lab-guide/strings.da';
import { mdxComponents } from '@/lab-guide/widgets/mdx';
import { loadExperiment } from '@/lib/content';
import { loadSimulation } from '@/lib/simulations';
import { parseModeParam } from '@/lib/url';
import type { SimulationModule } from '@/sim-contract';
import { MDXProvider } from '@mdx-js/react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export function ExperimentRoute() {
  const { topic, experiment } = useParams();
  const [searchParams] = useSearchParams();
  const mode = parseModeParam(searchParams.get('mode'));
  const loaded = topic && experiment ? loadExperiment(topic, experiment) : null;
  const [simulation, setSimulation] = useState<SimulationModule | undefined>(undefined);
  // Don't try to load a sim if the lab failed validation — `loaded` may be the
  // error variant which has no `frontmatter`.
  const simulationId = loaded && !('error' in loaded) ? loaded.frontmatter.simulationId : undefined;

  useEffect(() => {
    let cancelled = false;
    if (simulationId) {
      loadSimulation(simulationId).then((mod) => {
        if (!cancelled) setSimulation(mod);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [simulationId]);

  const phaseBodySource = loaded && !('error' in loaded) ? loaded.phaseBodies : null;
  const phaseBodies = useMemo<Record<string, React.ReactNode>>(
    () =>
      phaseBodySource
        ? Object.fromEntries(
            Object.entries(phaseBodySource).map(([id, Body]) => [id, <Body key={id} />]),
          )
        : {},
    [phaseBodySource],
  );

  if (!loaded) return <p>{strings.errors.notFound}</p>;
  if ('error' in loaded) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-5">
        <h1 className="text-xl text-red-900 mb-2">{strings.errors.labInvalidTitle}</h1>
        <pre className="text-sm text-red-900 whitespace-pre-wrap font-mono">{loaded.error}</pre>
        <p className="mt-3 text-sm text-red-800">{strings.errors.labInvalidHelp}</p>
      </div>
    );
  }

  const Theory = loaded.Theory;

  return (
    <MDXProvider components={mdxComponents}>
      <LabGuide
        experiment={loaded.frontmatter}
        topic={loaded.topic}
        slug={loaded.slug}
        mode={mode}
        theory={<Theory />}
        phaseBodies={phaseBodies}
        simulation={simulation}
      />
    </MDXProvider>
  );
}
