import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import { RubricResponse } from '@/lab-guide/widgets/RubricResponse';
import { MockEmbedder } from '@/lib/rubric/embedder';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

// A minimal rubric with one required semantic criterion + one literal-only
// required criterion. The mock embedder hands out vectors that make `passing`
// student text cosine 1.0 to the semantic anchor and `failing` text cosine 0.
const passingRubric = {
  id: 'r-test',
  version: 1,
  title: 'Test',
  criteria: [
    {
      id: 'sem',
      label: 'Semantisk',
      hint: 'Mangler semantik',
      any: [{ kind: 'semantic', threshold: 0.5, anchors: ['anchor good'] }],
    },
    {
      id: 'lit',
      label: 'Literal',
      hint: 'Mangler nøgleord',
      any: [{ kind: 'literal', terms: ['hypotese'] }],
    },
  ],
};

// "passing text" → vector identical to anchor; literal hit via word "hypotese"
const passingText = 'min hypotese om sammenhængen mellem X og Y er klar nok';
const failingText = 'jeg er usikker på hvad jeg skal sige om eksperimentet her';

const mockEmbedder = () =>
  new MockEmbedder({
    [passingText]: [1, 0],
    [failingText]: [0, 1],
    'anchor good': [1, 0],
  });

const gate: Gate = { type: 'rubric-required', widgetIds: ['hypotese'] };
const phase: Phase = { id: 'p', title: 'P', gate };

function GateProbe() {
  const { state, gateCtx } = useRunner();
  const passed = isGateSatisfied(gate, state, undefined, gateCtx, phase.id);
  return <div data-testid="gate">{passed ? 'pass' : 'fail'}</div>;
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
    </RunnerProvider>
  );
}

describe('RubricResponse', () => {
  it('renders the prompt + textarea', () => {
    render(
      <Harness experimentId="rr/1">
        <RubricResponse id="hypotese" prompt="Skriv en hypotese" rubric={passingRubric} />
      </Harness>,
    );
    expect(screen.getByText('Skriv en hypotese')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('disables the check button below the minWords floor', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr/2">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          minWords={5}
          embedder={mockEmbedder()}
        />
      </Harness>,
    );
    const button = screen.getByRole('button', { name: /tjek/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'one two three four five');
    expect(button).not.toBeDisabled();
  });

  it('flips the gate to pass on a successful check', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr/3">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          embedder={mockEmbedder()}
        />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
  });

  it('flips the gate back to fail on edit after a pass (dirty derivation)', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr/4">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          embedder={mockEmbedder()}
        />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    // Edit one character → dirty → gate re-closes, status pill flips.
    await user.type(screen.getByRole('textbox'), '!');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    expect(screen.getByText(/ændret siden tjek/i)).toBeInTheDocument();
  });

  it('keeps the gate closed when semantic checks are skipped-embedder but literal passes', async () => {
    // Embedder always throws → `evaluateRubric` records skipped-embedder for
    // the semantic check, but the literal "hypotese" still hits. The widget's
    // explicit embedder-down policy must keep the gate closed.
    const flakyEmbedder = {
      async embed() {
        throw new Error('embed server down');
      },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr/5">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          embedder={flakyEmbedder}
        />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/semantiske vurdering/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('renders an error card and registers satisfied:false on a malformed rubric', () => {
    // Missing required `criteria` array → parseRubric returns ok:false. The
    // widget must still register (hooks order stable) and show an error card.
    render(
      <Harness experimentId="rr/6">
        <RubricResponse id="hypotese" prompt="?" rubric={{ id: 'bad', version: 1 } as unknown} />
      </Harness>,
    );
    expect(screen.getByText(/rubric-validering fejlede/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });
});
