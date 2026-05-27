import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import { VariableTable, type VariableTableValues } from '@/lab-guide/widgets/VariableTable';
import type {
  CorrectnessReport,
  ExpectedVariables,
  RowMatch,
} from '@/lab-guide/widgets/variableTableCorrectness';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen, waitFor } from '@testing-library/react';
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
  const w = gateCtx.widgets.variables;
  const values = w?.kind === 'filled' ? (w.values as VariableTableValues | undefined) : undefined;
  return <div data-testid="values">{JSON.stringify(values ?? null)}</div>;
}

function StateProbe() {
  const { gateCtx } = useRunner();
  const w = gateCtx.widgets.variables;
  // Use the `in` check to distinguish "key absent" from "key present with undefined".
  const has = w && {
    hasCorrect: 'correct' in w,
    hasErrors: 'errors' in w,
    filled: w.kind === 'filled' ? w.filled : null,
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
  filled: boolean | null;
  correct: boolean | null | undefined;
  errors: CorrectnessReport | null | undefined;
} {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

function readValues(): VariableTableValues | null {
  return JSON.parse(screen.getByTestId('values').textContent ?? 'null');
}

function ivErrors(report: CorrectnessReport | null | undefined, idx = 0): RowMatch | undefined {
  return report?.iv?.[idx];
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
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'F');
    await user.type(
      document.getElementById('variables-dv0-name') as HTMLInputElement,
      'acceleration',
    );
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('does NOT flip to filled when only IV is filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/4">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'F');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('publishes uniform array-shaped values', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/5">
        <VariableTable id="variables" />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-iv0-unit') as HTMLInputElement, 'N');
    const values = readValues();
    expect(Array.isArray(values?.iv)).toBe(true);
    expect(Array.isArray(values?.dv)).toBe(true);
    expect(Array.isArray(values?.constants)).toBe(true);
    expect(values?.iv[0]).toEqual({ name: 'kraft', symbol: 'F', unit: 'N' });
  });

  it('with requireUnits=true, blocks filled until the unit cells are filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/6">
        <VariableTable id="variables" requireUnits />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.type(document.getElementById('variables-iv0-unit') as HTMLInputElement, 'N');
    await user.type(document.getElementById('variables-dv0-unit') as HTMLInputElement, 'm/s²');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('flips back to filled=false when an IV cell is cleared', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt/7">
        <VariableTable id="variables" />
      </Harness>,
    );
    const ivSym = document.getElementById('variables-iv0-symbol') as HTMLInputElement;
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(ivSym, 'F');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 'a');
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
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'kraft');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'F');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 'a');

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
    expect(firePaste(document.getElementById('variables-iv0-symbol') as HTMLInputElement)).toBe(
      true,
    );
    blocked.unmount();

    render(
      <Harness experimentId="vt-paste/allowed">
        <VariableTable id="variables" allowPaste />
      </Harness>,
    );
    expect(firePaste(document.getElementById('variables-iv0-symbol') as HTMLInputElement)).toBe(
      false,
    );
  });
});

describe('VariableTable — per-section config', () => {
  it('iv={{ count: 2 }} renders exactly 2 rows with no add/remove controls', () => {
    render(
      <Harness experimentId="vt-cfg/1">
        <VariableTable id="variables" iv={{ count: 2 }} />
      </Harness>,
    );
    expect(document.getElementById('variables-iv0-name')).not.toBeNull();
    expect(document.getElementById('variables-iv1-name')).not.toBeNull();
    expect(document.getElementById('variables-iv2-name')).toBeNull();
    expect(screen.queryByRole('button', { name: /tilføj uafhængig variabel/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /fjern uafhængig variabel/i })).toBeNull();
  });

  it('iv={{ min: 1, max: 3 }} starts at 1 row, + appears, × hides at min', () => {
    render(
      <Harness experimentId="vt-cfg/2">
        <VariableTable id="variables" iv={{ min: 1, max: 3 }} />
      </Harness>,
    );
    expect(document.getElementById('variables-iv0-name')).not.toBeNull();
    expect(document.getElementById('variables-iv1-name')).toBeNull();
    // At min: × hidden, + visible.
    expect(screen.queryByRole('button', { name: /fjern uafhængig variabel/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /tilføj uafhængig variabel/i })).not.toBeNull();
  });

  it('iv={{ min: 1, max: 3 }} clicking + adds rows; + hides at max', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-cfg/3">
        <VariableTable id="variables" iv={{ min: 1, max: 3 }} />
      </Harness>,
    );
    await user.click(screen.getByRole('button', { name: /tilføj uafhængig variabel/i }));
    await user.click(screen.getByRole('button', { name: /tilføj uafhængig variabel/i }));
    expect(document.getElementById('variables-iv2-name')).not.toBeNull();
    // At max: + hidden, × visible.
    expect(screen.queryByRole('button', { name: /tilføj uafhængig variabel/i })).toBeNull();
    expect(screen.queryAllByRole('button', { name: /fjern uafhængig variabel/i }).length).toBe(3);
  });

  it('filled requires count-in-bounds: iv={{ min: 2, max: 4 }} blocks at 1 filled row', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-cfg/4">
        <VariableTable id="variables" iv={{ min: 2, max: 4 }} />
      </Harness>,
    );
    // Starts at min=2 rows. Fill row 0 only.
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 't');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 't');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    // Fill row 1.
    await user.type(document.getElementById('variables-iv1-name') as HTMLInputElement, 'a');
    await user.type(document.getElementById('variables-iv1-symbol') as HTMLInputElement, 'a');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('constants={{ count: 2 }} starts at 2 rows + blocks filled until both are filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-cfg/5">
        <VariableTable id="variables" constants={{ count: 2 }} />
      </Harness>,
    );
    expect(document.getElementById('variables-c0-name')).not.toBeNull();
    expect(document.getElementById('variables-c1-name')).not.toBeNull();
    // Fill IV/DV but not constants.
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 't');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 't');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    // Fill constants.
    await user.type(document.getElementById('variables-c0-name') as HTMLInputElement, 'g');
    await user.type(document.getElementById('variables-c0-symbol') as HTMLInputElement, 'g');
    await user.type(document.getElementById('variables-c1-name') as HTMLInputElement, 'm');
    await user.type(document.getElementById('variables-c1-symbol') as HTMLInputElement, 'm');
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('PL11: no-config widget treats partial constants as not-blocking filled', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-cfg/6-pl11">
        <VariableTable id="variables" requireUnits />
      </Harness>,
    );
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'h');
    await user.type(document.getElementById('variables-iv0-unit') as HTMLInputElement, 'm');
    await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 't');
    await user.type(document.getElementById('variables-dv0-symbol') as HTMLInputElement, 't');
    await user.type(document.getElementById('variables-dv0-unit') as HTMLInputElement, 's');
    // Add two blank/partial constant rows.
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await user.type(document.getElementById('variables-c0-name') as HTMLInputElement, 'partial');
    // c1 stays fully blank, c0 has only `name` (partial).
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
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

  it('with expected, empty cells: correct=false, errors.iv[0] partial with empty markers', () => {
    render(
      <Harness experimentId="vt-c/2">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    const s = readState();
    expect(s.hasCorrect).toBe(true);
    expect(s.correct).toBe(false);
    const iv0 = ivErrors(s.errors, 0);
    expect(iv0?.status).toBe('partial');
    if (iv0?.status === 'partial') {
      expect(iv0.errors.name).toEqual({ type: 'empty' });
      expect(iv0.errors.symbol).toEqual({ type: 'empty' });
      expect(iv0.errors.unit).toEqual({ type: 'empty' });
    }
  });

  it('with expected, all correct + Tjek click: correct=true, errors.iv[0] matched', async () => {
    render(
      <Harness experimentId="vt-c/3">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv0', 'højde', 'h', 'm');
    await fillEntry('variables-dv0', 'tid', 't', 's');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await fillEntry('variables-c0', 'tyngdeacceleration', 'g', 'm/s²');
    expect(readState().correct).toBe(false);
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));

    const s = readState();
    expect(s.correct).toBe(true);
    expect(s.errors?.iv[0]).toMatchObject({ status: 'matched', expectedIndex: 0, studentIndex: 0 });
    expect(s.errors?.dv[0]).toMatchObject({ status: 'matched', expectedIndex: 0, studentIndex: 0 });
    expect(s.errors?.constants?.[0]).toMatchObject({
      status: 'matched',
      expectedIndex: 0,
      studentIndex: 0,
    });
  });

  it('with expected, wrong unit case: errors.iv[0].errors.unit = case-mismatch, correct=false', async () => {
    render(
      <Harness experimentId="vt-c/4">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv0', 'højde', 'h', 'M');
    await fillEntry('variables-dv0', 'tid', 't', 's');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /tilføj konstant/i }));
    await fillEntry('variables-c0', 'tyngdeacceleration', 'g', 'm/s²');

    const s = readState();
    expect(s.correct).toBe(false);
    const iv0 = ivErrors(s.errors, 0);
    expect(iv0?.status).toBe('partial');
    if (iv0?.status === 'partial') {
      expect(iv0.errors.unit).toEqual({ type: 'case-mismatch' });
    }
  });

  it("with expected.constants, student didn't add any: missing + correct=false", async () => {
    render(
      <Harness experimentId="vt-c/5">
        <VariableTable id="variables" requireUnits expected={fullExpected} />
      </Harness>,
    );
    await fillEntry('variables-iv0', 'højde', 'h', 'm');
    await fillEntry('variables-dv0', 'tid', 't', 's');
    const s = readState();
    expect(s.correct).toBe(false);
    expect(s.errors?.constants?.[0]).toEqual({ status: 'missing', expectedIndex: 0 });
  });

  it('expected.unit omitted on IV + requireUnits=false: blank unit → correct=true after Tjek', async () => {
    const partial: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-c/6">
        <VariableTable id="variables" expected={partial} />
      </Harness>,
    );
    await fillEntry('variables-iv0', 'højde', 'h', '');
    await fillEntry('variables-dv0', 'tid', 't', '');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readState().correct).toBe(true);
  });

  it('expected.unit omitted on IV + requireUnits=true: blank unit → correct=false (filled rule)', async () => {
    const partial: ExpectedVariables = {
      iv: { name: 'højde', symbol: 'h' },
      dv: { name: 'tid', symbol: 't' },
    };
    render(
      <Harness experimentId="vt-c/7">
        <VariableTable id="variables" requireUnits expected={partial} />
      </Harness>,
    );
    await fillEntry('variables-iv0', 'højde', 'h', '');
    await fillEntry('variables-dv0', 'tid', 't', '');
    const s = readState();
    expect(s.correct).toBe(false);
    const iv0 = ivErrors(s.errors, 0);
    if (iv0?.status === 'partial') {
      expect(iv0.errors.unit).toBeUndefined();
    }
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

  it('PL14: warns when expected.iv.length exceeds resolved max + drops extra entries', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tooMany: ExpectedVariables = {
      iv: [
        { name: 'højde', symbol: 'h' },
        { name: 'tid', symbol: 't' },
      ],
      dv: { name: 'fart', symbol: 'v' },
    };
    render(
      <Harness experimentId="vt-warn/3">
        <VariableTable id="variables" iv={{ count: 1 }} expected={tooMany} />
      </Harness>,
    );
    expect(
      warn.mock.calls.some((c) => typeof c[0] === 'string' && c[0].includes('exceeds section max')),
    ).toBe(true);
  });
});

describe('VariableTable — sections facet', () => {
  const sectionsExpected: ExpectedVariables = {
    iv: { name: 'højde', symbol: 'h', unit: 'm' },
    dv: { name: 'tid', symbol: 't', unit: 's' },
    constants: [
      { name: 'masse', symbol: 'm', unit: 'kg' },
      { name: 'tyngdeacceleration', symbol: 'g', unit: 'm/s²' },
    ],
  };

  function SectionsProbe() {
    const { gateCtx } = useRunner();
    const w = gateCtx.widgets.variables;
    const sections = w?.kind === 'filled' ? (w.sections ?? null) : null;
    return <div data-testid="sections">{JSON.stringify(sections)}</div>;
  }

  function readSections(): { iv: boolean; dv: boolean; constants: boolean } | null {
    return JSON.parse(screen.getByTestId('sections').textContent ?? 'null');
  }

  async function fill(prefix: string, name: string, symbol: string, unit: string) {
    const user = userEvent.setup();
    await user.type(document.getElementById(`${prefix}-name`) as HTMLInputElement, name);
    await user.type(document.getElementById(`${prefix}-symbol`) as HTMLInputElement, symbol);
    await user.type(document.getElementById(`${prefix}-unit`) as HTMLInputElement, unit);
  }

  const widget = (
    <VariableTable
      id="variables"
      iv={{ count: 1 }}
      dv={{ count: 1 }}
      constants={{ count: 2 }}
      requireUnits
      expected={sectionsExpected}
    />
  );

  it('reports all sections false before any Tjek', () => {
    render(
      <Harness experimentId="vt-sec/1">
        {widget}
        <SectionsProbe />
      </Harness>,
    );
    expect(readSections()).toEqual({ iv: false, dv: false, constants: false });
  });

  it('Tjek flips only the sections that are filled + correct', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-sec/2">
        {widget}
        <SectionsProbe />
      </Harness>,
    );
    await fill('variables-iv0', 'højde', 'h', 'm');
    // DV + constants left empty.
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readSections()).toEqual({ iv: true, dv: false, constants: false });
  });

  it('unlocking a locked IV cell drops only IV — DV + constants stay locked', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="vt-sec/3">
        {widget}
        <SectionsProbe />
      </Harness>,
    );
    await fill('variables-iv0', 'højde', 'h', 'm');
    await fill('variables-dv0', 'tid', 't', 's');
    await fill('variables-c0', 'masse', 'm', 'kg');
    await fill('variables-c1', 'tyngdeacceleration', 'g', 'm/s²');
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(readSections()).toEqual({ iv: true, dv: true, constants: true });

    // Under the lock model, the `sections` facet follows lock coverage —
    // not snapshot equality. Double-click any locked IV cell to start an
    // edit session, then type + blur to commit the unlock; IV's coverage
    // drops while DV and constants stay locked. This is the per-section
    // guarantee: unlocking one section's cell must not un-lock another
    // that the student already validated.
    const ivName = document.getElementById('variables-iv0-name') as HTMLInputElement;
    await user.dblClick(ivName);
    // Re-fetch after the readonly→editable render swap.
    const editable = document.getElementById('variables-iv0-name') as HTMLInputElement;
    await user.type(editable, 'Z');
    editable.blur();
    await waitFor(() => expect(readSections()).toEqual({ iv: false, dv: true, constants: true }));
  });
});

describe('VariableTable empty-state', () => {
  it('renders the default Danish empty-state message inside the Konstanter section when it has no rows', () => {
    render(
      <Harness experimentId="vt-empty/1">
        <VariableTable id="variables" />
      </Harness>,
    );
    expect(screen.getByText('Ingen konstanter tilføjet endnu.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Tilføj konstant' })).toBeInTheDocument();
  });

  it('honours an author override on constantsEmptyMessage', () => {
    render(
      <Harness experimentId="vt-empty/2">
        <VariableTable id="variables" constantsEmptyMessage="Brugerdefineret tom-tilstand" />
      </Harness>,
    );
    expect(screen.getByText('Brugerdefineret tom-tilstand')).toBeInTheDocument();
    expect(screen.queryByText('Ingen konstanter tilføjet endnu.')).not.toBeInTheDocument();
  });
});
