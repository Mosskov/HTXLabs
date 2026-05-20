// PhaseFooter merged-check-button: the 3-state footer button + gate-hint suppression.
import { PhaseFooter } from '@/lab-guide/PhaseFooter';
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import type { WidgetState } from '@/lab-guide/gates';
import { strings } from '@/lab-guide/strings.da';
import type { WidgetCheck } from '@/lab-guide/widgetCheck';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

const twoPhases = (gate: Gate): Phase[] => [
  { id: 'p1', title: 'P1', gate },
  { id: 'p2', title: 'P2', gate: { type: 'always' } },
];

/** Reads the runner's current phase id so phase advances are observable. */
function PhaseProbe() {
  const { state } = useRunner();
  return <div data-testid="phase">{state.currentPhaseId}</div>;
}

/** Stages widget state + check registrations once on mount. The staged
 *  objects are defined per test as stable consts so the effect runs once. */
function Driver({
  states,
  checks,
}: {
  states: Record<string, WidgetState>;
  checks: Record<string, WidgetCheck>;
}) {
  const { registerWidgetState, registerWidgetCheck } = useRunner();
  useEffect(() => {
    for (const [id, s] of Object.entries(states)) registerWidgetState(id, s);
    for (const [id, c] of Object.entries(checks)) registerWidgetCheck(id, c);
  }, [states, checks, registerWidgetState, registerWidgetCheck]);
  return null;
}

function Harness({
  experimentId,
  phases,
  states,
  checks,
}: {
  experimentId: string;
  phases: Phase[];
  states: Record<string, WidgetState>;
  checks: Record<string, WidgetCheck>;
}) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={phases}>
      <Driver states={states} checks={checks} />
      <PhaseProbe />
      <PhaseFooter phases={phases} />
    </RunnerProvider>
  );
}

function mkCheck(over: Partial<WidgetCheck> = {}): WidgetCheck {
  return { label: 'L', run: vi.fn(), disabled: false, pending: false, ...over };
}

const correctFilled: WidgetState = { kind: 'filled', filled: true, correct: true };
const plainFilled: WidgetState = { kind: 'filled', filled: true };

describe('PhaseFooter — no opted-in check (unchanged behaviour)', () => {
  it('shows "Næste fase", disabled, with the gate-hint when the gate is unsatisfied', () => {
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    render(<Harness experimentId="pf/1" phases={phases} states={{}} checks={{}} />);

    const btn = screen.getByRole('button', { name: /næste fase/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(strings.gates.allSatisfied)).toBeInTheDocument();
  });

  it('a gate without widgetIds is unaffected by registered checks', () => {
    const phases = twoPhases({ type: 'milestone', requires: 'm' });
    // A check is registered, but the milestone gate exposes no widgetIds, so
    // the footer can never surface it — behaviour is exactly as before.
    const checks = { foo: mkCheck({ label: 'Tjek foo' }) };
    render(<Harness experimentId="pf/2" phases={phases} states={{}} checks={checks} />);

    expect(screen.getByRole('button', { name: /næste fase/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /tjek foo/i })).not.toBeInTheDocument();
    expect(screen.getByText(strings.gates.milestone)).toBeInTheDocument();
  });
});

describe('PhaseFooter — merged check button', () => {
  it('surfaces the check of the first unsatisfied gate widget and runs it on click', async () => {
    const user = userEvent.setup();
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    const runA = vi.fn();
    const checks = { a: mkCheck({ label: 'Tjek A', run: runA }) };
    render(<Harness experimentId="pf/3" phases={phases} states={{}} checks={checks} />);

    const btn = screen.getByRole('button', { name: 'Tjek A' });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(runA).toHaveBeenCalledTimes(1);
  });

  it('walks widgetIds in order — once "a" is satisfied it advances to "b"’s check', () => {
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    const checks = { a: mkCheck({ label: 'Tjek A' }), b: mkCheck({ label: 'Tjek B' }) };
    render(
      <Harness experimentId="pf/4" phases={phases} states={{ a: correctFilled }} checks={checks} />,
    );

    expect(screen.queryByRole('button', { name: 'Tjek A' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tjek B' })).toBeInTheDocument();
  });

  it('suppresses the grey gate-hint while a check is active', () => {
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    const checks = { a: mkCheck({ label: 'Tjek A' }) };
    render(<Harness experimentId="pf/5" phases={phases} states={{}} checks={checks} />);

    expect(screen.getByRole('button', { name: 'Tjek A' })).toBeInTheDocument();
    expect(screen.queryByText(strings.gates.allSatisfied)).not.toBeInTheDocument();
  });

  it('a disabled check disables the footer button and blocks the run', async () => {
    const user = userEvent.setup();
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    const runA = vi.fn();
    const checks = { a: mkCheck({ label: 'Tjek A', run: runA, disabled: true }) };
    render(<Harness experimentId="pf/6" phases={phases} states={{}} checks={checks} />);

    const btn = screen.getByRole('button', { name: 'Tjek A' });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(runA).not.toHaveBeenCalled();
  });

  it('with both gate widgets satisfied the button advances the phase', async () => {
    const user = userEvent.setup();
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    render(
      <Harness
        experimentId="pf/7"
        phases={phases}
        states={{ a: correctFilled, b: correctFilled }}
        checks={{}}
      />,
    );

    expect(screen.getByTestId('phase')).toHaveTextContent('p1');
    const btn = screen.getByRole('button', { name: /næste fase/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(screen.getByTestId('phase')).toHaveTextContent('p2');
  });
});

describe('PhaseFooter — respects the gate strict flag', () => {
  it('strict: a filled-but-not-correct widget reads unsatisfied → its check is surfaced', () => {
    const phases = twoPhases({ type: 'all-satisfied', strict: true, widgetIds: ['a', 'b'] });
    const checks = { a: mkCheck({ label: 'Tjek A' }), b: mkCheck({ label: 'Tjek B' }) };
    // `a` is filled but carries no `correct` — strict treats it as unsatisfied.
    render(
      <Harness experimentId="pf/8" phases={phases} states={{ a: plainFilled }} checks={checks} />,
    );
    expect(screen.getByRole('button', { name: 'Tjek A' })).toBeInTheDocument();
  });

  it('non-strict: a filled widget reads satisfied → no check surfaced', () => {
    const phases = twoPhases({ type: 'all-satisfied', widgetIds: ['a', 'b'] });
    const checks = { a: mkCheck({ label: 'Tjek A' }), b: mkCheck({ label: 'Tjek B' }) };
    render(
      <Harness
        experimentId="pf/9"
        phases={phases}
        states={{ a: plainFilled, b: plainFilled }}
        checks={checks}
      />,
    );
    expect(screen.queryByRole('button', { name: /tjek a|tjek b/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /næste fase/i })).not.toBeDisabled();
  });
});

describe('PhaseFooter — all-validated gate', () => {
  it('a filled-but-incorrect widget reads unsatisfied → its check stays surfaced', () => {
    const phases = twoPhases({ type: 'all-validated', widgetIds: ['a'] });
    const checks = { a: mkCheck({ label: 'Tjek A' }) };
    // `all-validated` carries no `strict` flag, but a filled-but-incorrect
    // widget must NOT read satisfied — else the footer Tjek button vanishes and
    // the phase is stuck behind a still-locked gate.
    render(
      <Harness
        experimentId="pf/10"
        phases={phases}
        states={{ a: { kind: 'filled', filled: true, correct: false } }}
        checks={checks}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tjek A' })).toBeInTheDocument();
  });

  it('a correct widget reads satisfied → the button advances the phase', async () => {
    const user = userEvent.setup();
    const phases = twoPhases({ type: 'all-validated', widgetIds: ['a'] });
    render(
      <Harness experimentId="pf/11" phases={phases} states={{ a: correctFilled }} checks={{}} />,
    );
    const btn = screen.getByRole('button', { name: /næste fase/i });
    expect(btn).not.toBeDisabled();
    await user.click(btn);
    expect(screen.getByTestId('phase')).toHaveTextContent('p2');
  });
});
