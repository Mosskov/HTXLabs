import { LabGuide } from '@/lab-guide/LabGuide';
import { strings } from '@/lab-guide/strings.da';
import * as widgets from '@/lab-guide/widgets';
import { loadExperiment } from '@/lib/content';
import { loadSimulation } from '@/lib/simulations';
import type { SimulationModule } from '@/sim-contract';
import { MDXProvider } from '@mdx-js/react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const mdxComponents = {
  KeyEquation: widgets.KeyEquation,
  FreeTextResponse: widgets.FreeTextResponse,
  Checklist: widgets.Checklist,
  Quiz: widgets.Quiz,
  ResetButton: widgets.ResetButton,
  GateDebug: widgets.GateDebug,
};

export function ExperimentRoute() {
  const { topic, experiment } = useParams();
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

  const phaseBodies: Record<string, React.ReactNode> = {};
  for (const [id, Body] of Object.entries(loaded.phaseBodies)) {
    phaseBodies[id] = <Body />;
  }
  const Theory = loaded.Theory;

  return (
    <MDXProvider components={mdxComponents}>
      <LabGuide
        experiment={loaded.frontmatter}
        slug={loaded.slug}
        theory={<Theory />}
        phaseBodies={phaseBodies}
        simulation={simulation}
      />
    </MDXProvider>
  );
}
