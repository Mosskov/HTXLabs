// Experiment route: loads an experiment + its sim, then mounts either the lab landing (no `?mode=`) or the LabGuide for the selected mode.
import { LabGuide } from '@/lab-guide/LabGuide';
import { LabLanding } from '@/lab-guide/LabLanding';
import type { Mode } from '@/lab-guide/runner';
import { strings } from '@/lab-guide/strings.da';
import { mdxComponents } from '@/lab-guide/widgets/mdx';
import { loadExperiment, loadTopic } from '@/lib/content';
import { loadSimulation } from '@/lib/simulations';
import { parseModeParam } from '@/lib/url';
import type { SimulationModule } from '@/sim-contract';
import { MDXProvider } from '@mdx-js/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

export function ExperimentRoute() {
  const { topic, experiment } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawMode = searchParams.get('mode');
  const hasMode = rawMode !== null;
  const mode = parseModeParam(rawMode);
  const handleSelectMode = useCallback(
    (m: Mode) => {
      // Same-page swap: setting the param re-renders into LabGuide without a
      // full navigation, so theory/sim panels remount cleanly on first entry.
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', m);
        return next;
      });
    },
    [setSearchParams],
  );
  const handleSwitchInquiryForm = useCallback(() => {
    // Drop `mode` to re-render into LabLanding; runner state in localStorage
    // is preserved, so ModePicker can offer "FORTSÆT →" on the saved mode.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('mode');
      return next;
    });
  }, [setSearchParams]);

  // Theory disclosure default is closed in both contexts — a single bool is enough.
  const [theoryOpen, setTheoryOpen] = useState(false);
  const onToggleTheory = useCallback(() => setTheoryOpen((v) => !v), []);

  // Sim disclosure default differs by context (closed on landing, open in guide).
  // Tri-state: `null` means "untouched, use context default"; once the student
  // toggles, the explicit choice survives the landing↔guide swap.
  const [simOverride, setSimOverride] = useState<boolean | null>(null);
  const simOpen = simOverride ?? hasMode;
  const onToggleSim = useCallback(() => {
    setSimOverride((prev) => !(prev ?? hasMode));
  }, [hasMode]);
  // "Nulstil lab" view reset: drop ?mode= to land on the mode picker and
  // collapse both disclosures so the lab reads as a fresh visit.
  const handleResetView = useCallback(() => {
    setTheoryOpen(false);
    setSimOverride(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('mode');
      return next;
    });
  }, [setSearchParams]);
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
  const topicTitle = loadTopic(loaded.topic)?.frontmatter.title ?? loaded.topic;

  return (
    <MDXProvider components={mdxComponents}>
      {hasMode ? (
        <LabGuide
          experiment={loaded.frontmatter}
          topic={loaded.topic}
          topicTitle={topicTitle}
          slug={loaded.slug}
          mode={mode}
          theory={<Theory />}
          phaseBodies={phaseBodies}
          simulation={simulation}
          onSwitchInquiryForm={handleSwitchInquiryForm}
          onResetView={handleResetView}
          theoryOpen={theoryOpen}
          onToggleTheory={onToggleTheory}
          simOpen={simOpen}
          onToggleSim={onToggleSim}
        />
      ) : (
        <LabLanding
          experiment={loaded.frontmatter}
          topic={loaded.topic}
          topicTitle={topicTitle}
          slug={loaded.slug}
          theory={<Theory />}
          simulation={simulation}
          onSelectMode={handleSelectMode}
          onResetView={handleResetView}
          theoryOpen={theoryOpen}
          onToggleTheory={onToggleTheory}
          simOpen={simOpen}
          onToggleSim={onToggleSim}
        />
      )}
    </MDXProvider>
  );
}
