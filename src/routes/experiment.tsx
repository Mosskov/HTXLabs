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
  Reflection: widgets.Reflection,
  ConclusionStatement: widgets.ConclusionStatement,
  NulstilButton: widgets.NulstilButton,
  GateDebug: widgets.GateDebug,
};

export function ExperimentRoute() {
  const { topic, experiment } = useParams();
  const loaded = topic && experiment ? loadExperiment(topic, experiment) : null;
  const [simulation, setSimulation] = useState<SimulationModule | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (loaded?.frontmatter.simulationId) {
      loadSimulation(loaded.frontmatter.simulationId).then((mod) => {
        if (!cancelled) setSimulation(mod);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [loaded?.frontmatter.simulationId]);

  if (!loaded) return <p>{strings.errors.notFound}</p>;

  const phaseBodies: Record<string, React.ReactNode> = {};
  for (const [id, Body] of Object.entries(loaded.phaseBodies)) {
    phaseBodies[id] = <Body />;
  }
  const Theory = loaded.Theory;

  return (
    <MDXProvider components={mdxComponents}>
      <LabGuide
        experiment={loaded.frontmatter}
        theory={<Theory />}
        phaseBodies={phaseBodies}
        simulation={simulation}
      />
    </MDXProvider>
  );
}
