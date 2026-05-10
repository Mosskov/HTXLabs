import { LabGuide } from '@/lab-guide/LabGuide';
import { useRunner } from '@/lab-guide/RunnerContext';
import { gateMessage, isGateSatisfied } from '@/lab-guide/gates';
import { Checklist } from '@/lab-guide/widgets/Checklist';
import { FreeTextResponse } from '@/lab-guide/widgets/FreeTextResponse';
import { Quiz } from '@/lab-guide/widgets/Quiz';
import { strings } from '@/lab-guide/strings.da';
import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import type { SimulationModule } from '@/sim-contract';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

/** Renders one row per phase showing whether its gate currently passes. The
 *  probe lives inside the LabGuide tree, so it sees the same RunnerProvider
 *  the widgets registered against. */
function AllPhasesProbe({ phases }: { phases: Phase[] }) {
  const { state, gateCtx } = useRunner();
  return (
    <ul>
      {phases.map((p) => {
        const passed = isGateSatisfied(p.gate, state, undefined, gateCtx);
        return (
          <li key={p.id} data-testid={`gate-${p.id}`}>
            {passed ? 'pass' : 'fail'}
          </li>
        );
      })}
    </ul>
  );
}

const phases: Phase[] = [
  {
    id: 'planlaeg',
    title: 'P1',
    gate: { type: 'all-filled', widgetIds: ['ft1'] },
  },
  {
    id: 'maal',
    title: 'P2',
    gate: { type: 'all-checked', widgetIds: ['cl1'] },
  },
  {
    id: 'analyser',
    title: 'P3',
    gate: { type: 'all-correct', widgetIds: ['q1'] },
  },
  {
    id: 'diskuter',
    title: 'P4',
    gate: { type: 'keyword-count', widgetId: 'kw1', min: 'all' },
  },
];

const experiment: ExperimentFrontmatter = {
  version: 1,
  title: 'Test',
  topic: 'test-topic',
  simulationId: '__none',
  learningObjectives: ['x'],
  keyConcepts: [],
  difficulty: 'intro',
  modes: { guided: { phases } },
  labModes: { virtual: { enabled: true } },
  allowPaste: false,
  tags: [],
};

const phaseBodies: Record<string, React.ReactNode> = {
  planlaeg: <FreeTextResponse id="ft1" prompt="?" minWords={3} />,
  maal: (
    <Checklist
      id="cl1"
      items={[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]}
    />
  ),
  analyser: (
    <Quiz
      id="q1"
      prompt="?"
      options={[
        { id: 'x', label: 'X', correct: true },
        { id: 'y', label: 'Y' },
      ]}
    />
  ),
  diskuter: (
    <FreeTextResponse
      id="kw1"
      prompt="?"
      minWords={3}
      keywordGroups={[
        { id: 'g1', any: ['stiger'] },
        { id: 'g2', any: ['kraft'] },
      ]}
    />
  ),
};

describe('LabGuide — non-current phase gates evaluate from widgetValues at mount (B13)', () => {
  it('all four widget-backed gate kinds satisfy on initial mount when widgetValues is pre-seeded', () => {
    // Pre-seed localStorage with values that satisfy every gate. Current phase
    // is 'planlaeg' (the first); the other three are non-current — under the
    // pre-B13-fix code their widgets would never mount and their gates would
    // evaluate false. With the B13 fix every phase body mounts and registers.
    const seeded = {
      experimentId: 'test-topic/test-slug',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      firedMilestones: [],
      dataPointCount: 0,
      widgetValues: {
        ft1: 'three words minimum',
        cl1: { a: true, b: true },
        q1: 'x',
        'q1:checked': 'x',
        kw1: 'kraft stiger her med ord',
      },
      dataTables: {},
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:test-topic/test-slug', JSON.stringify(seeded));

    render(
      <LabGuide
        experiment={experiment}
        slug="test-slug"
        theory={<AllPhasesProbe phases={phases} />}
        phaseBodies={phaseBodies}
      />,
    );

    expect(screen.getByTestId('gate-planlaeg')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-maal')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-analyser')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-diskuter')).toHaveTextContent('pass');
  });

  it('non-current phase gates revert to fail when widgetValues are missing', () => {
    // Empty save — first-time visitor. Every widget mounts but registers
    // its derived "not satisfied" state.
    render(
      <LabGuide
        experiment={experiment}
        slug="test-slug"
        theory={<AllPhasesProbe phases={phases} />}
        phaseBodies={phaseBodies}
      />,
    );

    expect(screen.getByTestId('gate-planlaeg')).toHaveTextContent('fail');
    expect(screen.getByTestId('gate-maal')).toHaveTextContent('fail');
    expect(screen.getByTestId('gate-analyser')).toHaveTextContent('fail');
    expect(screen.getByTestId('gate-diskuter')).toHaveTextContent('fail');
  });
});

describe('LabGuide — open mode bypasses gates (B2)', () => {
  it('all gates pass with mode="open" even when widgetValues are empty', () => {
    render(
      <LabGuide
        experiment={experiment}
        slug="test-slug"
        mode="open"
        theory={<AllPhasesProbe phases={phases} />}
        phaseBodies={phaseBodies}
      />,
    );

    expect(screen.getByTestId('gate-planlaeg')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-maal')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-analyser')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-diskuter')).toHaveTextContent('pass');
  });

  it('URL-driven mode overrides a persisted mode without wiping progress', () => {
    // Persist a save with mode='guided' and a non-default currentPhaseId.
    // Loading with mode='open' should keep currentPhaseId but flip the gate
    // bypass on.
    const seeded = {
      experimentId: 'test-topic/test-slug',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'maal',
      visitedPhaseIds: ['planlaeg', 'maal'],
      firedMilestones: [],
      dataPointCount: 0,
      widgetValues: {},
      dataTables: {},
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:test-topic/test-slug', JSON.stringify(seeded));

    render(
      <LabGuide
        experiment={experiment}
        slug="test-slug"
        mode="open"
        theory={<AllPhasesProbe phases={phases} />}
        phaseBodies={phaseBodies}
      />,
    );

    // Bypass active despite empty widgetValues — proves URL mode reached state.
    expect(screen.getByTestId('gate-planlaeg')).toHaveTextContent('pass');
    expect(screen.getByTestId('gate-maal')).toHaveTextContent('pass');

    // Progress preserved: the persisted state is still the source of truth
    // for everything but the mode field.
    const persisted = JSON.parse(
      localStorage.getItem('htxlabs:state:test-topic/test-slug') ?? '{}',
    );
    expect(persisted.currentPhaseId).toBe('maal');
    expect(persisted.visitedPhaseIds).toEqual(expect.arrayContaining(['planlaeg', 'maal']));
  });
});

/** Probe that exposes runner side-effects as click targets so tests can drive
 *  sim-driven gate state (milestone fires, data-collected events, predicate
 *  state) without mounting a real simulation. */
function RunnerActionsProbe() {
  const { fireMilestone, onSimulationProgress, setSimulationState } = useRunner();
  return (
    <div>
      <button
        type="button"
        data-testid="probe-fire-m1"
        onClick={() => fireMilestone('m1')}
      >
        fire-m1
      </button>
      <button
        type="button"
        data-testid="probe-add-data"
        onClick={() => onSimulationProgress({ type: 'data-collected', count: 1 })}
      >
        +1
      </button>
      <button
        type="button"
        data-testid="probe-set-flag-on"
        onClick={() => setSimulationState({ flag: true })}
      >
        flag-on
      </button>
    </div>
  );
}

/** Two-phase fixture so the advance button stays labelled "Næste fase →"
 *  (single-phase labs flip it to "Afslut guide"). The second phase is a
 *  trivial always-gate filler — only the first phase is under test. */
function makeExperiment(phase: Phase, tags: string[] = []): ExperimentFrontmatter {
  const filler: Phase = { id: 'maal', title: 'P2', gate: { type: 'always' } };
  return {
    version: 1,
    title: 'Failure-path fixture',
    topic: 'test-topic',
    simulationId: '__none',
    learningObjectives: ['x'],
    keyConcepts: [],
    difficulty: 'intro',
    modes: { guided: { phases: [phase, filler] } },
    labModes: { virtual: { enabled: true } },
    allowPaste: false,
    tags,
  };
}

const stubSimulation: SimulationModule = {
  default: () => null,
  meta: {
    id: 'stub',
    title: 'Stub',
    mode: 'interactive',
    defaultParams: {},
    paramSchema: {},
    milestones: [],
  },
  gates: {
    'flag-on': (state) => Boolean((state as { flag?: boolean } | null)?.flag),
  },
};

describe('LabGuide — sim-driven gate failure paths', () => {
  it('milestone gate blocks advance and surfaces gateMessage until milestone fires', async () => {
    const user = userEvent.setup();
    const phase: Phase = {
      id: 'planlaeg',
      title: 'P1',
      gate: { type: 'milestone', requires: 'm1' },
    };

    render(
      <LabGuide
        experiment={makeExperiment(phase)}
        slug="ms-fixture"
        theory={<RunnerActionsProbe />}
        phaseBodies={{ planlaeg: <p>body</p>, maal: <p>body2</p> }}
      />,
    );

    const nextBtn = screen.getByRole('button', { name: strings.guide.nextPhase });
    expect(nextBtn).toBeDisabled();
    expect(screen.getByText(gateMessage(phase.gate))).toBeInTheDocument();

    await user.click(screen.getByTestId('probe-fire-m1'));

    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeEnabled();
    expect(screen.queryByText(gateMessage(phase.gate))).not.toBeInTheDocument();
  });

  it('data-points gate stays blocked at min-1, satisfies at min', async () => {
    const user = userEvent.setup();
    const phase: Phase = {
      id: 'planlaeg',
      title: 'P1',
      gate: { type: 'data-points', min: 2 },
    };

    render(
      <LabGuide
        experiment={makeExperiment(phase)}
        slug="dp-fixture"
        theory={<RunnerActionsProbe />}
        phaseBodies={{ planlaeg: <p>body</p>, maal: <p>body2</p> }}
      />,
    );

    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeDisabled();
    expect(screen.getByText(gateMessage(phase.gate))).toBeInTheDocument();

    await user.click(screen.getByTestId('probe-add-data'));
    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeDisabled();

    await user.click(screen.getByTestId('probe-add-data'));
    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeEnabled();
  });

  it('predicate gate blocks until simulationState satisfies the named predicate', async () => {
    const user = userEvent.setup();
    const phase: Phase = {
      id: 'planlaeg',
      title: 'P1',
      gate: { type: 'predicate', name: 'flag-on' },
    };

    render(
      <LabGuide
        experiment={makeExperiment(phase)}
        slug="pred-fixture"
        theory={<RunnerActionsProbe />}
        phaseBodies={{ planlaeg: <p>body</p>, maal: <p>body2</p> }}
        simulation={stubSimulation}
      />,
    );

    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeDisabled();
    expect(screen.getByText(gateMessage(phase.gate))).toBeInTheDocument();

    await user.click(screen.getByTestId('probe-set-flag-on'));

    expect(screen.getByRole('button', { name: strings.guide.nextPhase })).toBeEnabled();
  });
});
