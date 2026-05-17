import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import {
  VariableTable,
  type VariableTableValues,
} from '@/lab-guide/widgets/VariableTable';
import type {
  CorrectnessReport,
  ExpectedVariables,
} from '@/lab-guide/widgets/variableTableCorrectness';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const gate: Gate = { type: 'all-filled', widgetIds: ['variables'] };
const phase: Phase = { id: 'p', title: 'P', gate };

function GateProbe() {
  const { state, gateCtx } = useRunner();
  const passed = isGateSatisfied(gate, state, undefined, gateCtx, phase.id);
  return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
}

function ValuesProbe() {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets['variables'];
  const values = w?.kind === 'filled' ? (w.values as VariableTableValues | undefined) : undefined;
  return <div data-testid="values">{JSON.stringify(values?.iv ?? null)}</div>;
}

function StateProbe() {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets['variables'];
  // Use the `in` check to distinguish "key absent" from "key present with undefined".
  const has = w && {
    hasCorrect: 'correct' in w,
    hasErrors: 'errors' in w,
    correct: w.kind === 'filled' ? w.correct : null,
    errors: w.kind === 'filled' ? w.errors : null,
  };
  return <div data-testid="state">{JSON.stringify(has)}</div>;
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
      <GateProbe />
      <ValuesProbe />
      <StateProbe />
    </RunnerProvider>
  );
}

function readState(): {
  hasCorrect: boolean;
  hasErrors: boolean;
  correct: boolean | null | undefined;
  errors: CorrectnessReport | null | undefined;
} {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

describe('VariableTable', () => {
  it('renders IV, DV, and Konstanter section headers', () => {
    render(
      <Harness experimentId="vt/1">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.getByText('Uafhængig variabel')).toBeInTheDocument();
    expect(screen.getByText('Afhængig variabel')).toBeInTheDocument();
    expect(screen.getByText('Konstanter')).toBeInTheDocument();
  });

  it('reports filled=false on mount with empty cells', () => {
    render(
      <Harness experimentId="vt/2">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('flips to filled=true once IV and DV name+symbol are filled (units optional)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/3">
        <VariableTable id="variables" />
      </Harness>,
    );
    // Fill IV name + symbol; leave unit empty.
    const ivName = document.getElementById('variables-iv-name') as HTMLInputElement;
    const ivSym = document.getElementById('variables-iv-symbol') as HTMLInputElement;
    const dvName = document.getElementById('variables-dv-name') as HTMLInputElement;
    const dvSym = document.getElementById('variables-dv-symbol') as HTMLInputElement;
    await user.type(ivName, 'kraft');
    await user.type(ivSym, 'F');
    await user.type(dvName, 'acceleration');
    await user.type(dvSym, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('does NOT flip to filled when only IV is filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/4">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('publishes the entered IV symbol on the values facet', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/5">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-iv-unit') as HTMLInputElement, 'N');
    expect(screen.getByTestId('values')).toHaveTextContent('"symbol":"F"');
    expect(screen.getByTestId('values')).toHaveTextContent('"unit":"N"');
  });

  it('with requireUnits=true, blocks filled until the unit cells are filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/6">
        <VariableTable id="variables" requireUnits />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');
    // Units still empty.
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.type(document.getElementById('variables-iv-unit') as HTMLInputElement, 'N');
    await user.type(document.getElementById('variables-dv-unit') as HTMLInputElement, 'm/s²');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('flips back to filled=false when an IV cell is cleared', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/7">
        <VariableTable id="variables" />
      </Harness>,
    );
    const ivSym = document.getElementById('variables-iv-symbol') as HTMLInputElement;
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(ivSym, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    await user.clear(ivSym);
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('adds and removes constants without disturbing IV/DV satisfaction', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/8">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv-symbol') as HTMLInputElement, 'a');

    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    expect(document.getElementById('variables-c0-name')).not.toBeNull();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    await user.click(screen.getByRole('button', { name: /fjern konstant/i }));
    expect(document.getElementById('variables-c0-name')).toBeNull();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('repeated constant rows get a programmatic aria-label per cell', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/9">
        <VariableTable id="variables" />
      </Harness>,
    );
    // Two rows: first keeps the visible header; second falls back to aria-label.
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));

    const symbol2 = document.getElementById('variables-c1-symbol') as HTMLInputElement;
    expect(symbol2.getAttribute('aria-label')).toMatch(/Konstant 2.*Symbol/i);
    const name2 = document.getElementById('variables-c1-name') as HTMLInputElement;
    expect(name2.getAttribute('aria-label')).toMatch(/Konstant 2/i);
  });

  it('blocks paste by default; allowPaste lets it through', () => {
    function firePaste(input: HTMLElement): boolean {
      const evt = new Event('paste', { bubbles: true, cancelable: true });
      input.dispatchEvent(evt);
      return evt.defaultPrevented;
    }

    const blocked = render(
      <Harness experimentId="vt-paste/blocked">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(
      firePaste(document.getElementById('variables-iv-symbol') as HTMLInputElement),
    ).toBe(true);
    blocked.unmount();

    render(
      <Harness experimentId="vt-paste/allowed">
        <VariableTable id="variables" allowPaste />
      </Harness>,
    );
    expect(
      firePaste(document.getElementById('variables-iv-symbol') as HTMLInputElement),
    ).toBe(false);
  });
});

describe('VariableTable — expected (correctness checking)', () => {
  const fullExpected: ExpectedVariables = {
    iv: { name: ['højde', 'faldhøjde'], symbol: 'h', unit: 'm' },
    dv: { name: 'tid', symbol: 't', unit: 's' },
    constants: [{ name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' }],
  };

  async function fillEntry(prefix: string, name: string, symbol: string, unit: string) {
    const user = userEvent.setup();
    if (name) {
      await user.type(document.getElementById(`${prefix}-name`) as HTMLInputElement, name);
    }
    if (symbol) {
      await user.type(document.getElementById(`${prefix}-symbol`) as HTMLInputElement, symbol);
    }
    if (unit) {
      await user.type(document.getElementById(`${prefix}-unit`) as HTMLInputElement, unit);
    }
  }

  it('without expected: registered state has no correct/errors keys', () => {
    render(
      <Harness experimentId="vt-c/1">
        <VariableTable id="variables" />
      </Harness>,
    );
    const s = readState();
    expect(s.hasCorrect).toBe(false);
    expect(s.hasErrors).toBe(false);
  });

  it('with expected, empty cells: correct=false, errors carry empty markers', () => {
    render(
      <Harness experimentId="vt-c/2">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    const s = readState();
    expect(s.hasCorrect).toBe(true);
    expect(s.correct).toBe(false);
    expect(s.errors?.iv.name).toEqual({ type: 'empty' });
    expect(s.errors?.iv.symbol).toEqual({ type: 'empty' });
    expect(s.errors?.iv.unit).toEqual({ type: 'empty' });
  });

  it('with expected, all correct + Tjek click: correct=true, errors.iv = {}', async () => {
    render(
      <Harness experimentId="vt-c/3">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv', 'højde', 'h', 'm');
    await fillEntry('variables-dv', 'tid', 't', 's');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await fillEntry('variables-c0', 'tyngdeacceleration', 'g', 'm/s²');
    // Snapshot-gated: correct stays false until Tjek is clicked.
    expect(readState().correct).toBe(false);
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    const s = readState();
    expect(s.correct).toBe(true);
    expect(s.errors?.iv).toEqual({});
    expect(s.errors?.dv).toEqual({});
    expect(s.errors?.constants?.[0]).toEqual({
      status: 'matched',
      expectedIndex: 0,
      studentIndex: 0,
    });
  });

  it('with expected, wrong unit case: errors.iv.unit = case-mismatch, correct=false', async () => {
    render(
      <Harness experimentId="vt-c/4">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv', 'højde', 'h', 'M'); // wrong case
    await fillEntry('variables-dv', 'tid', 't', 's');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await fillEntry('variables-c0', 'tyngdeacceleration', 'g', 'm/s²');

    const s = readState();
    expect(s.correct).toBe(false);
    expect(s.errors?.iv.unit).toEqual({ type: 'case-mismatch' });
  });

  it('with expected.constants, student didn\'t add any: missing + correct=false', async () => {
    render(
      <Harness experimentId="vt-c/5">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv', 'højde', 'h', 'm');
    await fillEntry('variables-dv', 'tid', 't', 's');
    // No constants added.
    const s = readState();
    expect(s.correct).toBe(false);
    expect(s.errors?.constants?.[0]).toEqual({ status: 'missing', expectedIndex: 0 });
  });

  it('expected.unit omitted on IV + requireUnits=false: blank unit → correct=true after Tjek', async () => {
    const partial: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' }, // no unit
      dv: { name: 'tid', symbol: 't' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-c/6">
        <VariableTable id="variables" expected={partial} />
      </Harness>,
    );
    await fillEntry('variables-iv', 'højde', 'h', '');
    await fillEntry('variables-dv', 'tid', 't', '');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    const s = readState();
    expect(s.correct).toBe(true);
  });

  it('expected.unit omitted on IV + requireUnits=true: blank unit → correct=false (filled rule)', async () => {
    const partial: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' }, // no unit
      dv: { name: 'tid', symbol: 't' }, // no unit
    };
    render(
      <Harness experimentId="vt-c/7">
        <VariableTable id="variables" requireUnits expected={partial} />
      </Harness>,
    );
    await fillEntry('variables-iv', 'højde', 'h', '');
    await fillEntry('variables-dv', 'tid', 't', '');
    const s = readState();
    // requireUnits demands non-empty unit → filled=false → correct=false
    // even though errors.iv.unit is undefined (expected.unit not declared).
    expect(s.correct).toBe(false);
    expect(s.errors?.iv.unit).toBeUndefined();
  });
});

describe('VariableTable — dev-warn guard for malformed constants', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when expected.constants entry has neither symbol nor name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malformed: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
      // Cast bypasses the discriminated-union check — simulating a teacher
      // who slipped past the type system.
      constants: [{} as never],
    };
    render(
      <Harness experimentId="vt-warn/1">
        <VariableTable id="variables" expected={malformed} />
      </Harness>,
    );
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('variables');
    expect(warn.mock.calls[0][0]).toContain('neither symbol nor name');
  });

  it('does NOT warn on valid expected.constants', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const valid: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
      constants: [{ symbol: 'g' }],
    };
    render(
      <Harness experimentId="vt-warn/2">
        <VariableTable id="variables" expected={valid} />
      </Harness>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
