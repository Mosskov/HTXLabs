import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import * as Mod from '@/lab-guide/widgets/Quiz';
import { Quiz } from '@/lab-guide/widgets/Quiz';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

const phase: Phase = {
  id: 'p',
  title: 'P',
  gate: { type: 'all-correct', widgetIds: ['q'] },
};
const gate: Gate = phase.gate;

const options = [
  { id: 'a', label: 'A', correct: true },
  { id: 'b', label: 'B' },
];

function GateProbe() {
  const { state, gateCtx } = useRunner();
  const passed = isGateSatisfied(gate, state, undefined, gateCtx);
  return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
}

function Harness({ experimentId, children }: { experimentId: string; children: React.ReactNode }) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
      {children}
      <GateProbe />
    </RunnerProvider>
  );
}

/** Toggle Quiz on/off without unmounting RunnerProvider — simulates a phase
 *  swap inside the same lab session, which is exactly the B14 scenario. */
function Toggleable({ id }: { id: string }) {
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <Quiz id={id} prompt="?" options={options} />}
      <button type="button" data-testid="toggle" onClick={() => setMounted((m) => !m)}>
        toggle
      </button>
    </>
  );
}

describe('Quiz', () => {
  it('exports the component', () => {
    expect(Mod.Quiz).toBeDefined();
    expect(typeof Mod.Quiz).toBe('function');
  });

  it('registers correct after Tjek and persists picked option', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="t/1">
        <Quiz id="q" prompt="?" options={options} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');

    await user.click(screen.getAllByRole('radio')[0]);
    expect(screen.getByTestId('gate')).toHaveTextContent('fail'); // not checked yet
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    const saved = JSON.parse(localStorage.getItem('htxlabs:state:t/1') ?? '{}');
    expect(saved.widgetValues).toEqual({ q: 'a', 'q:checked': 'a' });
  });

  it('re-locks when the user picks a different option after a check', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="t/2">
        <Quiz id="q" prompt="?" options={options} />
      </Harness>,
    );
    await user.click(screen.getAllByRole('radio')[0]);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    await user.click(screen.getAllByRole('radio')[1]);
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('preserves passed `correct` across remount inside the same session (B14 sibling key)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="t/3">
        <Toggleable id="q" />
      </Harness>,
    );
    await user.click(screen.getAllByRole('radio')[0]);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    // Unmount Quiz, then remount — RunnerProvider state is preserved.
    await user.click(screen.getByTestId('toggle'));
    await user.click(screen.getByTestId('toggle'));

    // Without re-pressing Tjek, the gate should still be satisfied because
    // checkedFor is now derived from widgetValues['q:checked'].
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('preserves passed `correct` across reload (registers correct:true without re-Tjek)', () => {
    // Pre-seed localStorage as if the student had passed the gate, then closed
    // the tab. Mount fresh: RunnerProvider's load() rehydrates, Quiz derives
    // checkedFor from the sibling key, registers correct:true on first effect.
    const seeded = {
      experimentId: 't/4',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'p',
      visitedPhaseIds: ['p'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: { q: 'a', 'q:checked': 'a' },
      dataTables: {},
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:t/4', JSON.stringify(seeded));

    render(
      <Harness experimentId="t/4">
        <Quiz id="q" prompt="?" options={options} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('degrades gracefully on old saves missing the sibling key (student re-Tjek once)', async () => {
    const seeded = {
      experimentId: 't/5',
      experimentVersion: 1,
      mode: 'guided',
      labMode: 'virtual',
      currentPhaseId: 'p',
      visitedPhaseIds: ['p'],
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: { q: 'a' }, // no `q:checked` — pre-B14 save shape
      dataTables: {},
      attemptCounts: {},
    };
    localStorage.setItem('htxlabs:state:t/5', JSON.stringify(seeded));

    const user = userEvent.setup();
    render(
      <Harness experimentId="t/5">
        <Quiz id="q" prompt="?" options={options} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });
});
