// Lock-model tests for VariableTable: Tjek-flash-and-lock, unlock affordances
// (double-click / Enter / F2 / long-press), expected-row-keyed lock identity
// for multi-row sections, gate behaviour through `all-validated` and through
// `all-satisfied { strict: true }`.
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied, widgetSatisfied } from '@/lab-guide/gates';
import { VariableTable } from '@/lab-guide/widgets/VariableTable';
import type { ExpectedVariables } from '@/lab-guide/widgets/variableTableCorrectness';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

function StateProbe() {
  const { state, gateCtx } = useRunner();
  const w = gateCtx.widgets.variables;
  const correct = w?.kind === 'filled' ? w.correct : undefined;
  const sections = w?.kind === 'filled' ? w.sections : null;
  const locks = state.variableTableLocks.variables ?? {};
  return (
    <div data-testid="state">
      {JSON.stringify({ correct, sections, lockKeys: Object.keys(locks).sort() })}
    </div>
  );
}

function readState() {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

function Harness({
  experimentId,
  children,
}: {
  experimentId: string;
  children: React.ReactNode;
}) {
  return (
    <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
      {children}
      <StateProbe />
    </RunnerProvider>
  );
}

async function typeInto(id: string, value: string) {
  const user = userEvent.setup();
  await user.type(document.getElementById(id) as HTMLInputElement, value);
}

const fullExpected: ExpectedVariables = {
  iv: { name: 'højde', symbol: 'h', unit: 'm' },
  dv: { name: 'tid', symbol: 't', unit: 's' },
};

function isLocked(inputId: string): boolean {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  return input?.hasAttribute('readonly') ?? false;
}

describe('VariableTable lock model', () => {
  it('Tjek with all correct: every configured cell locks (readOnly input)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/lock-on-correct">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    expect(isLocked('variables-iv0-name')).toBe(true);
    expect(isLocked('variables-iv0-symbol')).toBe(true);
    expect(isLocked('variables-iv0-unit')).toBe(true);
    expect(isLocked('variables-dv0-name')).toBe(true);
    expect(isLocked('variables-dv0-symbol')).toBe(true);
    expect(isLocked('variables-dv0-unit')).toBe(true);

    const s = readState();
    expect(s.correct).toBe(true);
    expect(s.sections).toEqual({ iv: true, dv: true, constants: true });
    expect(s.lockKeys).toEqual([
      'dv.0.name',
      'dv.0.symbol',
      'dv.0.unit',
      'iv.0.name',
      'iv.0.symbol',
      'iv.0.unit',
    ]);
  });

  it('empty cells are ignored — no lock, no flash, stays an editable input', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/empty-ignored">
        <VariableTable id="variables" expected={fullExpected} />
      </Harness>,
    );
    // Fill only IV; leave DV empty.
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // DV cells stay editable + no lock entries for them.
    expect(isLocked('variables-dv0-name')).toBe(false);
    expect(isLocked('variables-dv0-symbol')).toBe(false);
    expect(isLocked('variables-dv0-unit')).toBe(false);
    const s = readState();
    expect(s.lockKeys).toEqual(['iv.0.name', 'iv.0.symbol', 'iv.0.unit']);
    expect(s.correct).toBe(false);
  });

  it('wrong cells stay editable + DO NOT lock', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/wrong-no-lock">
        <VariableTable id="variables" expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'WRONG');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    expect(isLocked('variables-iv0-symbol')).toBe(false);
    expect(isLocked('variables-iv0-name')).toBe(true);
    expect(isLocked('variables-iv0-unit')).toBe(true);
    expect(readState().correct).toBe(false);
  });

  it('double-click on a locked cell unlocks it; the editable input takes focus', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/dblclick-unlock">
        <VariableTable id="variables" expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(isLocked('variables-iv0-symbol')).toBe(true);

    await user.dblClick(document.getElementById('variables-iv0-symbol') as HTMLInputElement);
    expect(isLocked('variables-iv0-symbol')).toBe(false);

    // Focus lands on the newly-rendered editable input.
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('variables-iv0-symbol')),
    );

    // Lock entry is dropped from state.
    expect(readState().lockKeys).not.toContain('iv.0.symbol');
    expect(readState().correct).toBe(false);
  });

  it('Enter on a focused locked cell unlocks it', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/enter-unlock">
        <VariableTable id="variables" expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    const locked = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    expect(locked).toHaveAttribute('readonly');
    locked.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(isLocked('variables-iv0-symbol')).toBe(false));
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('variables-iv0-symbol')),
    );
  });

  it('F2 on a focused locked cell also unlocks it', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/f2-unlock">
        <VariableTable id="variables" expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    const locked = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    locked.focus();
    await user.keyboard('{F2}');
    await waitFor(() => expect(isLocked('variables-iv0-symbol')).toBe(false));
  });

  it('touch long-press (≥500ms) unlocks; short tap does not', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Harness experimentId="vtl/longpress">
          <VariableTable id="variables" expected={fullExpected} />
        </Harness>,
      );
      await typeInto('variables-iv0-name', 'højde');
      await typeInto('variables-iv0-symbol', 'h');
      await typeInto('variables-dv0-name', 'tid');
      await typeInto('variables-dv0-symbol', 't');
      await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

      const locked = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
      const wrapper = locked.parentElement?.parentElement?.parentElement as HTMLElement;
      expect(wrapper).toBeTruthy();

      // Short tap — touchstart + touchend within 200ms; lock stays.
      wrapper.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(200);
      wrapper.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
      vi.advanceTimersByTime(400);
      expect(isLocked('variables-iv0-symbol')).toBe(true);

      // Long press — timer fires at 500ms, unlocks.
      wrapper.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      vi.advanceTimersByTime(500);
      await waitFor(() => expect(isLocked('variables-iv0-symbol')).toBe(false));
    } finally {
      vi.useRealTimers();
    }
  });

  it('multi-row IV with reverse-order entry: locks track expected-row identity', async () => {
    const reverseExpected: ExpectedVariables = {
      iv: [
        { name: 'højde', symbol: 'h', unit: 'm' },
        { name: 'tid', symbol: 't', unit: 's' },
      ],
      dv: { name: 'fart', symbol: 'v', unit: 'm/s' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/multi-row-reverse">
        <VariableTable id="variables" iv={{ count: 2 }} requireUnits expected={reverseExpected} />
      </Harness>,
    );
    // Student rows entered in reverse: row 0 → tid, row 1 → højde.
    await typeInto('variables-iv0-name', 'tid');
    await typeInto('variables-iv0-symbol', 't');
    await typeInto('variables-iv0-unit', 's');
    await typeInto('variables-iv1-name', 'højde');
    await typeInto('variables-iv1-symbol', 'h');
    await typeInto('variables-iv1-unit', 'm');
    await typeInto('variables-dv0-name', 'fart');
    await typeInto('variables-dv0-symbol', 'v');
    await typeInto('variables-dv0-unit', 'm/s');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // Lock entries address expected-row identity, not render position.
    const s = readState();
    expect(s.lockKeys).toEqual(
      expect.arrayContaining(['iv.0.name', 'iv.0.symbol', 'iv.0.unit']),
    );
    expect(s.lockKeys).toEqual(
      expect.arrayContaining(['iv.1.name', 'iv.1.symbol', 'iv.1.unit']),
    );
    // Both rendered rows are locked (regardless of which expected row each paired to).
    expect(isLocked('variables-iv0-symbol')).toBe(true);
    expect(isLocked('variables-iv1-symbol')).toBe(true);

    // Unlock rendered row 0 (which paired to expected[1] = tid). The lock keyed
    // to expected[1] should disappear; the one keyed to expected[0] (paired to
    // rendered row 1 = højde) stays. This is the load-bearing assertion for
    // expected-row-keyed lock identity — unlocking by render position would
    // drop the wrong key.
    await user.dblClick(document.getElementById('variables-iv0-symbol') as HTMLInputElement);
    const after = readState();
    expect(after.lockKeys).not.toContain('iv.1.symbol');
    expect(after.lockKeys).toEqual(expect.arrayContaining(['iv.0.symbol']));
  });

  it('gate via all-validated reads correct === true; unlocking re-closes it', async () => {
    const gate: Gate = { type: 'all-validated', widgetIds: ['variables'] };
    function GateProbe() {
      const { state, gateCtx } = useRunner();
      const passed = isGateSatisfied(gate, state, undefined, gateCtx, 'p');
      return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
    }
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/all-validated">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
        <GateProbe />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    // Unlock one cell — gate closes.
    await user.dblClick(document.getElementById('variables-iv0-symbol') as HTMLInputElement);
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('gate via all-satisfied { strict: true } follows the same lock-based correct', async () => {
    // Mirrors the template lab's actual gate shape (no rubric here so we read
    // widgetSatisfied directly). Strict projects `filled && correct === true`.
    const user = userEvent.setup();
    function StrictProbe() {
      const { gateCtx } = useRunner();
      const w = gateCtx.widgets.variables;
      const satisfied = widgetSatisfied(w, true);
      return <div data-testid="strict">{satisfied ? 'pass' : 'fail'}</div>;
    }
    render(
      <Harness experimentId="vtl/strict">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
        <StrictProbe />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    expect(screen.getByTestId('strict')).toHaveTextContent('fail');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByTestId('strict')).toHaveTextContent('pass');
    await user.dblClick(document.getElementById('variables-iv0-symbol') as HTMLInputElement);
    expect(screen.getByTestId('strict')).toHaveTextContent('fail');
  });

  it('flash wrapper paints emerald/rose for 1.5s after Tjek; clears afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(
        <Harness experimentId="vtl/flash-window">
          <VariableTable id="variables" expected={fullExpected} />
        </Harness>,
      );
      await typeInto('variables-iv0-name', 'højde');
      await typeInto('variables-iv0-symbol', 'h');
      await typeInto('variables-dv0-name', 'tid');
      await typeInto('variables-dv0-symbol', 'WRONG');
      await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

      // Right after Tjek: at least one cell paints emerald, at least one rose.
      const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
      const anyEmerald = inputs.some((i) =>
        i.parentElement?.parentElement?.className.includes('bg-emerald-100'),
      );
      const anyRose = inputs.some((i) =>
        i.parentElement?.parentElement?.className.includes('bg-rose-100'),
      );
      expect(anyEmerald).toBe(true);
      expect(anyRose).toBe(true);

      // After 1500ms the flash clears.
      vi.advanceTimersByTime(1600);
      await waitFor(() => {
        const stillFlashing = Array.from(document.querySelectorAll('input')).some(
          (i) =>
            i.parentElement?.parentElement?.className.includes('bg-emerald-100') ||
            i.parentElement?.parentElement?.className.includes('bg-rose-100'),
        );
        expect(stillFlashing).toBe(false);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty cell with stale lock: silently drops the lock, cell stays editable', async () => {
    // Lock a cell (Tjek with correct), then unlock + clear it (now empty).
    // Re-Tjek: the empty-cell rule short-circuits — the stale lock stays
    // dropped, the cell stays as an empty editable input (not a locked span,
    // not a wrong-flash). This is the round-4 PL7 fix: empty cells are
    // ignored, even when a stale lock entry would otherwise survive.
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/stale-lock-empty">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readState().lockKeys).toContain('iv.0.symbol');

    // Unlock + clear iv0-symbol.
    await user.dblClick(document.getElementById('variables-iv0-symbol') as HTMLInputElement);
    const ivSymbol = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    await user.clear(ivSymbol);

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // Lock entry stays dropped (the cell is empty, so it's ignored by Tjek).
    // The cell renders as an editable empty input — never re-locks itself.
    expect(readState().lockKeys).not.toContain('iv.0.symbol');
    expect(isLocked('variables-iv0-symbol')).toBe(false);
    expect(ivSymbol.value).toBe('');
  });

  it('row removal preserves lock entries but drops the gate', async () => {
    const constantsExpected: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h', unit: 'm' },
      dv: { name: 'tid', symbol: 't', unit: 's' },
      constants: [
        { name: 'masse', symbol: 'm', unit: 'kg' },
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
      ],
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtl/row-remove">
        <VariableTable
          id="variables"
          requireUnits
          constants={{ min: 0, max: 3 }}
          expected={constantsExpected}
        />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    await typeInto('variables-dv0-unit', 's');
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await typeInto('variables-c0-name', 'masse');
    await typeInto('variables-c0-symbol', 'm');
    await typeInto('variables-c0-unit', 'kg');
    await typeInto('variables-c1-name', 'tyngdeacceleration');
    await typeInto('variables-c1-symbol', 'g');
    await typeInto('variables-c1-unit', 'm/s²');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readState().correct).toBe(true);

    // Remove the first constants row (paired to expected[0]). The lock entries
    // for that expected row persist in state but no longer contribute to
    // coverage because the matcher no longer pairs them to a rendered row.
    const removeButtons = screen.getAllByRole('button', { name: /fjern konstant/i });
    await user.click(removeButtons[0]);
    expect(readState().correct).toBe(false);
    expect(readState().sections.constants).toBe(false);

    // Re-add a constants row + Tjek with wrong values. The stale `constants.0.*`
    // locks must not resurrect the gate — `correct` is gated on the matcher
    // currently pairing each expected row, not on lock presence alone. The
    // freshly-added row is editable (no inherited lock).
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    // After removal of c0 (masse), the surviving row is at index 0; the new
    // row appends to index 1.
    await typeInto('variables-c1-name', 'forkert');
    await typeInto('variables-c1-symbol', 'x');
    await typeInto('variables-c1-unit', 'X');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readState().correct).toBe(false);
    expect(readState().sections.constants).toBe(false);
    expect(isLocked('variables-c1-symbol')).toBe(false);
  });
});
