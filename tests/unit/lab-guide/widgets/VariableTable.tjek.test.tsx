// Tjek-flow tests for VariableTable: snapshot-gated `correct`, per-cell tiered
// hints, status pill, commonMistakes integration.
import { HintSpendProvider, useHintSpend } from '@/lab-guide/HintSpendContext';
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { VariableTable } from '@/lab-guide/widgets/VariableTable';
import {
  type ExpectedVariables,
  resolveLadder,
} from '@/lab-guide/widgets/variableTableCorrectness';
import type { Phase } from '@/lib/schema';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const phase: Phase = { id: 'p', title: 'P', gate: { type: 'always' } };

function StateProbe() {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets.variables;
  const info = w?.kind === 'filled' ? { correct: w.correct } : null;
  return <div data-testid="state">{JSON.stringify(info)}</div>;
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

function readCorrect(): boolean | null | undefined {
  const parsed = JSON.parse(screen.getByTestId('state').textContent ?? 'null');
  return parsed?.correct;
}

const expectedSymbolsOnly: ExpectedVariables = {
  iv: {
    symbol: {
      accepted: 'X',
      hints: ['author iv hint 1', 'author iv hint 2'],
    },
    // `wrong: 'Q'` rather than a case variant: a case variant would
    // be resolved to `case-mismatch` before common-mistake refinement
    // gets a chance (refineCellError only refines `mismatch`).
    commonMistakes: {
      symbol: [{ kind: 'wrong-letter', wrong: 'Q', hint: 'wrong-letter mistake hint' }],
    },
  },
  dv: {
    symbol: 'Y',
  },
};

async function typeInto(id: string, value: string) {
  const user = userEvent.setup();
  await user.type(document.getElementById(id) as HTMLInputElement, value);
}

describe('VariableTable Tjek flow', () => {
  it('without `expected`: no Tjek button, no status pill', () => {
    render(
      <Harness experimentId="vtj/no-expected">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.queryByRole('button', { name: /tjek mine variable/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ikke tjekket endnu/i)).not.toBeInTheDocument();
  });

  it('with `expected`: no hints before Tjek (tier=0)', async () => {
    render(
      <Harness experimentId="vtj/idle">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    // Even though IV symbol is empty (an error), no hint should appear because tier=0.
    expect(screen.queryByText(/dette felt er tomt/i)).not.toBeInTheDocument();
  });

  it('typing correct values before Tjek: correct stays false', async () => {
    render(
      <Harness experimentId="vtj/pre-tjek-correct">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    // Snapshot not taken → correct stays false.
    expect(readCorrect()).toBe(false);
  });

  it('Tjek with correct values: correct flips to true, visible pill hidden + sr-only "Godkendt" announced', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/tjek-correct">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readCorrect()).toBe(true);
    // Visible pill is hidden on full success (per-cell green carries the
    // signal); sr-only role="status" element fires the AT announcement.
    expect(screen.queryByTestId('variable-table-status-pill')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Godkendt');
  });

  it('unlocking a cell after a passing Tjek: correct flips back to false', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/edit-after-pass">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readCorrect()).toBe(true);

    // Under the lock model, `correct` follows lock coverage — not snapshot
    // equality. Editing a non-locked cell (iv0-name has no expected entry)
    // changes the live values but leaves the IV/DV symbol locks intact, so
    // `correct` stays true. To flip it, the student must commit an unlock
    // on a locked cell — double-click starts an edit session, but the lock
    // entry only drops once the student actually changes the value and
    // blurs (deferred-commit model).
    const ivSymbol = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    expect(ivSymbol).toHaveAttribute('readonly');
    await user.dblClick(ivSymbol);
    // Re-fetch after the readonly→editable render swap.
    const editable = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    await user.type(editable, 'Z');
    editable.blur();
    await waitFor(() => expect(readCorrect()).toBe(false));
  });

  it('Tjek does NOT auto-reveal any ladder hint (request-driven model)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/no-auto-tier">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong — generic mismatch ladder
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Inline ladder hints are removed; popup is closed until focus + spend.
    expect(screen.queryByText('Tjek dit symbol.')).not.toBeInTheDocument();
  });

  it('focus after Tjek opens a popup with the free case-mismatch diagnostic', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/free-case-popup">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch (expected 'X')
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Popup is closed until the student focuses the cell.
    expect(screen.queryByText(/tjek dette symbol — er stort\/lille bogstav rigtigt/i)).not
      .toBeInTheDocument();
    const input = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    input.focus();
    expect(
      await screen.findByText(/tjek dette symbol — er stort\/lille bogstav rigtigt/i),
    ).toBeInTheDocument();
  });

  it('popup does NOT open on focus before any Tjek (feedback-only rule)', async () => {
    render(
      <Harness experimentId="vtj/feedback-only">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch — but no Tjek yet
    const input = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    input.focus();
    // Pre-Tjek focus must not surface diagnostics — violates the locked
    // "feedback only / no pre-attempt scaffolding" decision.
    expect(screen.queryByText(/tjek dette symbol — er stort\/lille bogstav rigtigt/i)).not
      .toBeInTheDocument();
  });

  it('empty cell shows no popup after Tjek (the empty ladder was dropped)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/empty-no-hint">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    // Leave IV symbol empty.
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // An empty input is self-evident — no "Dette felt er tomt." hint, and no
    // other hint surfaces under the empty cell (only its "Symbol" label).
    expect(screen.queryByText(/dette felt er tomt/i)).not.toBeInTheDocument();
    const ivSymbol = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    expect(ivSymbol.closest('div')?.textContent).toBe('Symbol');
  });

  it('editing a checked section hides its popup diagnostics until re-Tjek', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/dirty-hides-popup">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    const input = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    input.focus();
    expect(
      await screen.findByText(/tjek dette symbol — er stort\/lille bogstav rigtigt/i),
    ).toBeInTheDocument();

    // Editing the section flips it dirty → popup must not surface stale
    // feedback until a fresh Tjek.
    input.blur();
    await typeInto('variables-iv0-name', 'X');
    input.focus();
    expect(
      screen.queryByText(/tjek dette symbol — er stort\/lille bogstav rigtigt/i),
    ).not.toBeInTheDocument();
  });

  it('F7: paid tier 1 on a case-mismatch is NOT the same text as the free tier 0 diagnostic', () => {
    // Unit-level guarantee: the paid ladder for a case-mismatch starts AFTER
    // the free entry. The integration test below relies on this.
    const ladder = resolveLadder({ type: 'case-mismatch' }, undefined, 'symbol');
    expect(ladder[0]).toBe('Brug samme store/små bogstav som i teorien.');
    expect(ladder).not.toContain('Tjek dette symbol — er stort/lille bogstav rigtigt?');
  });

  it('F6: revealed paid tier survives clearing the cell to retry', async () => {
    const user = userEvent.setup();
    // Stub probe lets the test dispatch a spend without driving the bucket +
    // lightbulb UI. The Spender computes `revealedText` the same way the
    // widget's `onSpendCell` does — via `resolveLadder` on the live error —
    // so the integration covers the F7 slice end-to-end too.
    function Spender() {
      const { spendAndRevealVtTier } = useRunner();
      return (
        <button
          type="button"
          data-testid="spend-dv-symbol"
          onClick={() => {
            const ladder = resolveLadder({ type: 'case-mismatch' }, undefined, 'symbol');
            spendAndRevealVtTier({
              widgetId: 'variables',
              cellKey: 'dv.0.symbol',
              revealedText: ladder[0] as string,
              hintCap: ladder.length,
            });
          }}
        >
          spend
        </button>
      );
    }
    render(
      <Harness experimentId="vtj/f6-paid-survives-clear">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
        <Spender />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'y'); // case-mismatch (expected 'Y')
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    await user.click(screen.getByTestId('spend-dv-symbol'));

    const dvSymbol = document.getElementById('variables-dv0-symbol') as HTMLInputElement;
    dvSymbol.focus();
    // Sanity: paid hint visible on clean section.
    expect(
      await screen.findByText('Brug samme store/små bogstav som i teorien.'),
    ).toBeInTheDocument();
    dvSymbol.blur();

    // Genuine F6 repro: clear the DV symbol cell to retry. The error type now
    // flips from `case-mismatch` to `empty` — the paid hint must still surface.
    await user.clear(dvSymbol);
    dvSymbol.focus();
    expect(
      await screen.findByText('Brug samme store/små bogstav som i teorien.'),
    ).toBeInTheDocument();
    // Free diagnostic for case-mismatch is gone (current error is now `empty`).
    expect(
      screen.queryByText('Tjek dette symbol — er stort/lille bogstav rigtigt?'),
    ).not.toBeInTheDocument();
  });

  it('missing constant: surfaces a "Du mangler en konstant" message after Tjek', async () => {
    const expectedWithConstant: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
      constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/missing-constant">
        <VariableTable id="variables" expected={expectedWithConstant} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');
    // No constants added.
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(
      screen.getByText('Du mangler en konstant: tyngdeacceleration (g, m/s²).'),
    ).toBeInTheDocument();
  });


  it('array expected.iv: order-independent matching pairs by symbol key', async () => {
    const expectedArr: import('@/lab-guide/widgets/variableTableCorrectness').ExpectedVariables = {
      iv: [
        { name: 'højde', symbol: 'h', unit: 'm' },
        { name: 'tid', symbol: 't', unit: 's' },
      ],
      dv: { name: 'fart', symbol: 'v', unit: 'm/s' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/array-iv">
        <VariableTable id="variables" iv={{ count: 2 }} requireUnits expected={expectedArr} />
      </Harness>,
    );
    // Student enters IVs in reversed order — order-independent matcher pairs by symbol.
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
    // Full success → visible pill hidden, sr-only live status carries the copy.
    expect(screen.queryByTestId('variable-table-status-pill')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Godkendt');
  });

});

describe('VariableTable per-cell lock confirmation', () => {
  // Under the lock model, the per-cell "correct" signal is "the cell renders
  // as a readOnly input" (locked). Cells without an `expected[cell]` entry,
  // and wrong cells, stay editable.
  function isLocked(inputId: string): boolean {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    return input?.hasAttribute('readonly') ?? false;
  }

  it('passing Tjek: every expected-defined cell becomes readOnly (locked)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-lock/passing">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // expectedSymbolsOnly only sets `symbol` on IV and DV — name and unit
    // are not part of the answer key, so they stay editable.
    expect(isLocked('variables-iv0-symbol')).toBe(true);
    expect(isLocked('variables-dv0-symbol')).toBe(true);
    expect(isLocked('variables-iv0-name')).toBe(false);
    expect(isLocked('variables-dv0-name')).toBe(false);
  });

  it('mixed Tjek: only error-free expected-defined cells lock', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-lock/mixed">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong — generic mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(isLocked('variables-iv0-symbol')).toBe(false);
    expect(isLocked('variables-dv0-symbol')).toBe(true);
  });

  it('unlocking a locked cell drops the gate; siblings stay locked', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-lock/unlock-one">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(isLocked('variables-iv0-symbol')).toBe(true);
    expect(isLocked('variables-dv0-symbol')).toBe(true);
    // Double-click iv0-symbol's read-only input → starts edit session; type
    // + blur commits the unlock. DV symbol stays locked (locks are per-cell,
    // not per-section).
    const ivSym = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    await user.dblClick(ivSym);
    // Re-fetch after the readonly→editable render swap.
    const editableIv = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    await user.type(editableIv, 'Z');
    editableIv.blur();
    await waitFor(() => expect(isLocked('variables-iv0-symbol')).toBe(false));
    expect(isLocked('variables-dv0-symbol')).toBe(true);
    // The whole-table success announcement unmounts (gate no longer satisfied).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('without `expected`: no cells ever lock, no Tjek button', () => {
    render(
      <Harness experimentId="vtj-lock/no-expected">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(isLocked('variables-iv0-symbol')).toBe(false);
    expect(isLocked('variables-dv0-symbol')).toBe(false);
    expect(screen.queryByRole('button', { name: /tjek mine variable/i })).not.toBeInTheDocument();
  });
});

describe('VariableTable checkInFooter (footer-driven Tjek)', () => {
  // Reads the runner's footer-check registry + exposes a button to invoke it,
  // standing in for the PhaseFooter the widget would normally be driven by.
  function CheckRunner() {
    const { widgetChecks } = useRunner();
    const check = widgetChecks.variables;
    return (
      <div>
        <span data-testid="vc-label">{check?.label ?? '(none)'}</span>
        <button type="button" data-testid="vc-run" onClick={() => check?.run()}>
          run
        </button>
      </div>
    );
  }

  it('suppresses the in-widget Tjek button and registers a footer check', () => {
    render(
      <Harness experimentId="vtf/registered">
        <VariableTable
          id="variables"
          expected={expectedSymbolsOnly}
          checkInFooter
          checkLabel="Tjek variable"
        />
        <CheckRunner />
      </Harness>,
    );
    expect(screen.queryByRole('button', { name: /tjek mine variable/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('vc-label')).toHaveTextContent('Tjek variable');
  });

  it('footer-driven run() flips correct just like the in-widget Tjek', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtf/run">
        <VariableTable id="variables" expected={expectedSymbolsOnly} checkInFooter />
        <CheckRunner />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    expect(readCorrect()).toBe(false);
    await user.click(screen.getByTestId('vc-run'));
    expect(readCorrect()).toBe(true);
  });

  it('without checkInFooter: keeps the in-widget button, registers no footer check', () => {
    render(
      <Harness experimentId="vtf/off">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
        <CheckRunner />
      </Harness>,
    );
    expect(screen.getByRole('button', { name: /tjek mine variable/i })).toBeInTheDocument();
    expect(screen.getByTestId('vc-label')).toHaveTextContent('(none)');
  });
});

describe('VariableTable in-field hint indicator (F4 + F8)', () => {
  // Calls enterSpendMode/exitSpendMode imperatively for the new tests. Mirrors
  // the helper in HintLightbulb.test.tsx: armed state is driven via a button
  // click so it fires AFTER HintSpendProvider's initial-IDLE effect, like
  // production.
  function SpendControls({ phaseId }: { phaseId: string }) {
    const { enterSpendMode, exitSpendMode, spendMode } = useHintSpend();
    return (
      <div>
        <button type="button" data-testid="arm" onClick={() => enterSpendMode(phaseId)}>
          arm
        </button>
        <button type="button" data-testid="disarm" onClick={() => exitSpendMode()}>
          disarm
        </button>
        <span data-testid="spend-mode">{spendMode.kind}</span>
      </div>
    );
  }

  function ArmedHarness({
    experimentId,
    children,
  }: {
    experimentId: string;
    children: React.ReactNode;
  }) {
    return (
      <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
        <HintSpendProvider>
          <SpendControls phaseId="p" />
          {children}
        </HintSpendProvider>
      </RunnerProvider>
    );
  }

  /** Reads the live `border-amber-300` (armed cue) state from the symbol input. */
  function symbolInput(): HTMLInputElement {
    return document.getElementById('variables-iv0-symbol') as HTMLInputElement;
  }

  /** The idle amber dot is the only `span.bg-amber-400` in the cell wrapper. */
  function idleDotPresent(input: HTMLInputElement): boolean {
    return !!input.closest('div')?.querySelector('span.bg-amber-400');
  }

  function hintTickBridge(input: HTMLInputElement): HTMLElement | null {
    return input.closest('div')?.querySelector('span.bg-amber-400')?.parentElement ?? null;
  }

  it('armed-border coexists with hint ticks (border = spend-mode cue, ticks = hint count)', async () => {
    const user = userEvent.setup();
    render(
      <ArmedHarness experimentId="vtf4/border-vs-dot">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </ArmedHarness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // Idle: ticks present (no border).
    const input = symbolInput();
    expect(idleDotPresent(input)).toBe(true);
    expect(hintTickBridge(input)?.className).toContain('left-2');
    expect(hintTickBridge(input)?.className).not.toContain('right-2');
    expect(input.className).not.toContain('border-amber-300');

    // Arm: border on, ticks still present (no mutual exclusion).
    await user.click(screen.getByTestId('arm'));
    expect(input.className).toContain('border-amber-400');
    expect(input.className).toContain('ring-amber-300');
    expect(input.className).toContain('cursor-pointer');
    expect(idleDotPresent(input)).toBe(true);

    // Disarm: ticks still present.
    await user.click(screen.getByTestId('disarm'));
    expect(input.className).not.toContain('border-amber-400');
    expect(idleDotPresent(input)).toBe(true);
  });

  it('click-to-spend on armed cell: spends, exits spend mode, auto-focuses + opens popup', async () => {
    const user = userEvent.setup();
    render(
      <ArmedHarness experimentId="vtf4/click-spend">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </ArmedHarness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    await user.click(screen.getByTestId('arm'));
    expect(screen.getByTestId('spend-mode')).toHaveTextContent('active');

    const input = symbolInput();
    await user.click(input);

    // Spend mode exited.
    expect(screen.getByTestId('spend-mode')).toHaveTextContent('idle');
    // Cell auto-focuses on the setTimeout(0) tick.
    await waitFor(() => expect(document.activeElement).toBe(input));
    // Popup is open against the freshly revealed tier.
    expect(
      await screen.findByText('Brug samme store/små bogstav som i teorien.'),
    ).toBeInTheDocument();
  });

  it('Enter-to-spend on armed focused cell: spends, exits, refocuses + popup reflects reveal', async () => {
    const user = userEvent.setup();
    render(
      <ArmedHarness experimentId="vtf4/enter-spend">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </ArmedHarness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    await user.click(screen.getByTestId('arm'));

    const input = symbolInput();
    input.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('spend-mode')).toHaveTextContent('idle');
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(
      await screen.findByText('Brug samme store/små bogstav som i teorien.'),
    ).toBeInTheDocument();
  });

  it('idle amber dot appears in no-provider harness once Tjek surfaces a popup entry', async () => {
    // No HintSpendProvider — default-tolerant useHintSpend() means armed is
    // never true, so this also covers the dot-present-in-fallback path.
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtf4/idle-dot">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'x'); // case-mismatch

    // Before Tjek: section is dirty → popup will not open → no dot.
    expect(idleDotPresent(symbolInput())).toBe(false);

    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // After Tjek: free case-mismatch diagnostic populates the popup → dot.
    expect(idleDotPresent(symbolInput())).toBe(true);
  });
});
