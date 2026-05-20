// Tjek-flow tests for VariableTable: snapshot-gated `correct`, per-cell tiered
// hints, status pill, commonMistakes integration.
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { VariableTable } from '@/lab-guide/widgets/VariableTable';
import type { ExpectedVariables } from '@/lab-guide/widgets/variableTableCorrectness';
import type { Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
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

  it('editing a cell after a passing Tjek: correct flips back to false', async () => {
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

    // Edit any cell — even with a still-valid value — must flip correct back.
    await typeInto('variables-iv0-name', 'X');
    expect(readCorrect()).toBe(false);
  });

  it('Tjek with wrong commonMistake value: tier-1 hint matches the mistake hint', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/common-mistake">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Q'); // matches commonMistake.wrong
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('wrong-letter mistake hint')).toBeInTheDocument();
  });

  it('Tjek twice with persistent error: tier escalates from 1 to 2', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/tier-escalate">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // not a commonMistake, just wrong — uses generic mismatch ladder
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // First tier of generic symbol/mismatch ladder ("Tjek dit symbol.")
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Second tier of the generic ladder.
    expect(
      screen.getByText('Brug det symbol teorien introducerer for denne størrelse.'),
    ).toBeInTheDocument();
  });

  it('empty cell shows no hint after Tjek (the empty ladder was dropped)', async () => {
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

  it('author hint appears after generic ladder is exhausted', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/author-hint">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // generic mismatch — ladder length 2
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');

    // Tjek 1 → tier 1 (generic[0])
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Tjek 2 → tier 2 (generic[1])
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Tjek 3 → tier 3 (author hint 1)
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('author iv hint 1')).toBeInTheDocument();
  });

  it('unit row-swapped: surfaces a row-swapped hint under the unit cell', async () => {
    const expectedWithUnits: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h', unit: 'm' },
      dv: { name: 'acceleration', symbol: 'a', unit: 'm/s²' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/unit-row-swapped">
        <VariableTable id="variables" requireUnits expected={expectedWithUnits} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm/s²'); // belongs to DV
    await typeInto('variables-dv0-name', 'acceleration');
    await typeInto('variables-dv0-symbol', 'a');
    await typeInto('variables-dv0-unit', 'm'); // belongs to IV
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Both IV and DV units are row-swapped → expect the hint to surface twice.
    expect(screen.getAllByText('Denne enhed hører til den anden variabel.')).toHaveLength(2);
  });

  it('unit whitespace-internal: surfaces a whitespace-internal hint under the unit cell', async () => {
    const expectedWithUnit: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h', unit: 'm' },
      dv: { name: 'acceleration', symbol: 'a', unit: 'm/s²' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/unit-whitespace">
        <VariableTable id="variables" requireUnits expected={expectedWithUnit} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-iv0-unit', 'm');
    await typeInto('variables-dv0-name', 'acceleration');
    await typeInto('variables-dv0-symbol', 'a');
    await typeInto('variables-dv0-unit', 'm / s²'); // internal whitespace
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(
      screen.getByText('Enheden er korrekt, men der er et ekstra mellemrum indeni.'),
    ).toBeInTheDocument();
  });

  it('editing a cell in a section hides that section\'s hints (per-section dirty)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/dirty-hides-hints">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong → IV mismatch hint
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();

    // Editing an IV cell flips IV to dirty → the IV hint vanishes until the
    // next Tjek, so live error guidance doesn't leak.
    await typeInto('variables-iv0-name', 'x');
    expect(screen.queryByText('Tjek dit symbol.')).not.toBeInTheDocument();
  });

  it('editing one section keeps a sibling section\'s hints (per-section dirty)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/sibling-keeps-hints">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong → IV mismatch hint
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();

    // Editing a DV cell must NOT dirty IV — the IV hint stays put.
    await typeInto('variables-dv0-name', 'x');
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();
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

  it('out-of-order partial constant: hint renders on the actual student row', async () => {
    // Two expected constants. The student enters them in reverse order and
    // makes a unit typo on the second-expected one (g). The partial-match
    // hint must surface on the actual student row (row 0), not the row that
    // happens to share its index with the expectedIndex.
    const expectedTwoConstants: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
      constants: [
        { name: 'masse', symbol: 'm', unit: 'kg' },
        { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
      ],
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/constant-out-of-order">
        <VariableTable id="variables" expected={expectedTwoConstants} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'højde');
    await typeInto('variables-iv0-symbol', 'h');
    await typeInto('variables-dv0-name', 'tid');
    await typeInto('variables-dv0-symbol', 't');

    // Add two constant rows.
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));

    // Row 0 = g (the second-expected constant), with a wrong unit.
    await typeInto('variables-c0-name', 'tyngdeacceleration');
    await typeInto('variables-c0-symbol', 'g');
    await typeInto('variables-c0-unit', 'wrong');
    // Row 1 = m (the first-expected constant), fully correct.
    await typeInto('variables-c1-name', 'masse');
    await typeInto('variables-c1-symbol', 'm');
    await typeInto('variables-c1-unit', 'kg');

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    // The unit-mismatch hint should appear under student row 0's unit cell,
    // not under row 1 (whose index matches the expectedIndex of g).
    const row0Unit = document.getElementById('variables-c0-unit') as HTMLInputElement;
    const row0UnitWrapper = row0Unit.closest('div');
    expect(row0UnitWrapper?.textContent ?? '').toContain('Tjek enheden.');
    const row1Unit = document.getElementById('variables-c1-unit') as HTMLInputElement;
    const row1UnitWrapper = row1Unit.closest('div');
    expect(row1UnitWrapper?.textContent ?? '').not.toContain('Tjek enheden.');
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

  it('tier keys for array IV use iv.<expectedIndex>.<cell>', async () => {
    const expectedArr: import('@/lab-guide/widgets/variableTableCorrectness').ExpectedVariables = {
      iv: [{ symbol: 'h' }, { symbol: 't' }],
      dv: { symbol: 'v' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/array-iv-tier">
        <VariableTable id="variables" iv={{ count: 2 }} expected={expectedArr} />
      </Harness>,
    );
    // Row 0 (positional → expectedIndex 0) has wrong symbol; row 1 has correct.
    await typeInto('variables-iv0-name', 'a');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong → mismatch
    await typeInto('variables-iv1-name', 'b');
    await typeInto('variables-iv1-symbol', 't');
    await typeInto('variables-dv0-name', 'c');
    await typeInto('variables-dv0-symbol', 'v');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();
  });
});

describe('VariableTable per-cell green confirmation', () => {
  // The `data-correct` marker lives on the wrapping <div> the Field renders
  // around each ProtectedInput. Reading from the input back up to the wrapper
  // keeps the assertion robust to extra wrapper changes.
  function cellMarker(inputId: string): string | null | undefined {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    return input?.closest('div')?.getAttribute('data-correct');
  }

  it('passing Tjek: every expected-defined cell has data-correct="true"', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-green/passing">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // expectedSymbolsOnly only sets `symbol` on IV and DV — name and unit
    // are not part of the answer key, so they stay unmarked.
    expect(cellMarker('variables-iv0-symbol')).toBe('true');
    expect(cellMarker('variables-dv0-symbol')).toBe('true');
    expect(cellMarker('variables-iv0-name')).toBeNull();
    expect(cellMarker('variables-dv0-name')).toBeNull();
  });

  it('mixed Tjek: only error-free expected-defined cells get the marker; wrong cell has hint, not green', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-green/mixed">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'Z'); // wrong — generic mismatch
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(cellMarker('variables-iv0-symbol')).toBeNull();
    expect(cellMarker('variables-dv0-symbol')).toBe('true');
    // Hint surfaces under the wrong cell — green and hint are mutually exclusive.
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();
  });

  it('editing a section after a passing Tjek clears its green but keeps siblings', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj-green/dirty">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv0-name', 'Force');
    await typeInto('variables-iv0-symbol', 'X');
    await typeInto('variables-dv0-name', 'Acceleration');
    await typeInto('variables-dv0-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(cellMarker('variables-iv0-symbol')).toBe('true');
    // Edit an IV cell — IV green clears, but DV (untouched) keeps its green.
    await typeInto('variables-iv0-name', 'X');
    expect(cellMarker('variables-iv0-symbol')).toBeNull();
    expect(cellMarker('variables-dv0-symbol')).toBe('true');
    // The whole-table success announcement unmounts (no longer all-checked).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('without `expected`: no data-correct markers ever, no Tjek button', () => {
    render(
      <Harness experimentId="vtj-green/no-expected">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(cellMarker('variables-iv0-symbol')).toBeNull();
    expect(cellMarker('variables-dv0-symbol')).toBeNull();
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
