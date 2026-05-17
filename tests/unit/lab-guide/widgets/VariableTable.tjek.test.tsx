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

  it('with `expected`: shows pill in idle state and no hints before Tjek', async () => {
    render(
      <Harness experimentId="vtj/idle">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    expect(screen.getByText(/ikke tjekket endnu/i)).toBeInTheDocument();
    // Even though IV symbol is empty (an error), no hint should appear because tier=0.
    expect(screen.queryByText(/dette felt er tomt/i)).not.toBeInTheDocument();
  });

  it('typing correct values before Tjek: correct stays false and pill stays idle', async () => {
    render(
      <Harness experimentId="vtj/pre-tjek-correct">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'X');
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    // Snapshot not taken → correct stays false, pill stays idle.
    expect(readCorrect()).toBe(false);
    expect(screen.getByText(/ikke tjekket endnu/i)).toBeInTheDocument();
  });

  it('Tjek with correct values: correct flips to true, pill "Godkendt"', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/tjek-correct">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'X');
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readCorrect()).toBe(true);
    expect(screen.getByText('Godkendt')).toBeInTheDocument();
  });

  it('editing a cell after a passing Tjek: correct flips back to false, pill "Ændret siden tjek"', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/edit-after-pass">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'X');
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readCorrect()).toBe(true);

    // Edit any cell — even with a still-valid value — must flip correct back.
    await typeInto('variables-iv-name', 'X');
    expect(readCorrect()).toBe(false);
    expect(screen.getByText(/ændret siden tjek/i)).toBeInTheDocument();
  });

  it('Tjek with wrong commonMistake value: tier-1 hint matches the mistake hint', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/common-mistake">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'Q'); // matches commonMistake.wrong
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('wrong-letter mistake hint')).toBeInTheDocument();
    expect(screen.getByText(/tjekket — se tips/i)).toBeInTheDocument();
  });

  it('Tjek twice with persistent error: tier escalates from 1 to 2', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/tier-escalate">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'Z'); // not a commonMistake, just wrong — uses generic mismatch ladder
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // First tier of generic symbol/mismatch ladder ("Tjek dit symbol.")
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Second tier of the generic ladder.
    expect(
      screen.getByText('Brug det symbol teorien introducerer for denne størrelse.'),
    ).toBeInTheDocument();
  });

  it('empty cell hint stays at "Dette felt er tomt." and does not escalate', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/empty-stays">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    // Leave IV symbol empty.
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Dette felt er tomt.')).toBeInTheDocument();

    // Click again — ladder length is 1, so the same text is shown (no escalation).
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getAllByText('Dette felt er tomt.').length).toBeGreaterThanOrEqual(1);
  });

  it('author hint appears after generic ladder is exhausted', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/author-hint">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'Z'); // generic mismatch — ladder length 2
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');

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
    await typeInto('variables-iv-name', 'højde');
    await typeInto('variables-iv-symbol', 'h');
    await typeInto('variables-iv-unit', 'm/s²'); // belongs to DV
    await typeInto('variables-dv-name', 'acceleration');
    await typeInto('variables-dv-symbol', 'a');
    await typeInto('variables-dv-unit', 'm'); // belongs to IV
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
    await typeInto('variables-iv-name', 'højde');
    await typeInto('variables-iv-symbol', 'h');
    await typeInto('variables-iv-unit', 'm');
    await typeInto('variables-dv-name', 'acceleration');
    await typeInto('variables-dv-symbol', 'a');
    await typeInto('variables-dv-unit', 'm / s²'); // internal whitespace
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(
      screen.getByText('Enheden er korrekt, men der er et ekstra mellemrum indeni.'),
    ).toBeInTheDocument();
  });

  it('hints disappear when the student edits a cell after a Tjek (dirty state)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/dirty-hides-hints">
        <VariableTable id="variables" expected={expectedSymbolsOnly} />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'Z'); // wrong → mismatch
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Tjek dit symbol.')).toBeInTheDocument();

    // Editing any cell flips status to dirty → hints should vanish until
    // the student clicks Tjek again, so live error guidance doesn't leak.
    await typeInto('variables-dv-name', 'x');
    expect(screen.queryByText('Tjek dit symbol.')).not.toBeInTheDocument();
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
    await typeInto('variables-iv-name', 'højde');
    await typeInto('variables-iv-symbol', 'h');
    await typeInto('variables-dv-name', 'tid');
    await typeInto('variables-dv-symbol', 't');
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
    await typeInto('variables-iv-name', 'højde');
    await typeInto('variables-iv-symbol', 'h');
    await typeInto('variables-dv-name', 'tid');
    await typeInto('variables-dv-symbol', 't');

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

  it('checkedWithErrorsStatusLabel override replaces the default copy', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vtj/override">
        <VariableTable
          id="variables"
          expected={expectedSymbolsOnly}
          checkedWithErrorsStatusLabel="Tjek igen"
        />
      </Harness>,
    );
    await typeInto('variables-iv-name', 'Force');
    await typeInto('variables-iv-symbol', 'Z');
    await typeInto('variables-dv-name', 'Acceleration');
    await typeInto('variables-dv-symbol', 'Y');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Tjek igen')).toBeInTheDocument();
    expect(screen.queryByText(/tjekket — se tips/i)).not.toBeInTheDocument();
  });
});
