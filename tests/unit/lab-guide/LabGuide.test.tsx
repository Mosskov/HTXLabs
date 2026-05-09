import { LabGuide } from '@/lab-guide/LabGuide';
import { useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import { Checklist } from '@/lab-guide/widgets/Checklist';
import { FreeTextResponse } from '@/lab-guide/widgets/FreeTextResponse';
import { Quiz } from '@/lab-guide/widgets/Quiz';
import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
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
      experimentId: 'test-topic/__none',
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
    localStorage.setItem('htxlabs:state:test-topic/__none', JSON.stringify(seeded));

    render(
      <LabGuide
        experiment={experiment}
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
