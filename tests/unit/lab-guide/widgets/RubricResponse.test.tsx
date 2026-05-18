import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import { LabPasteContext } from '@/lab-guide/widgets/ProtectedInput';
import { RubricResponse } from '@/lab-guide/widgets/RubricResponse';
import { MockEmbedder } from '@/lib/rubric/embedder';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={mockEmbedder()} />
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
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={mockEmbedder()} />
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
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={flakyEmbedder} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/semantiske vurdering/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
  });

  it('blocks paste by default; allowPaste lets it through', () => {
    // Helper: dispatch a real paste event and report whether the widget called
    // preventDefault — the proxy ProtectedTextarea exposes for the SEN escape.
    function firePaste(textarea: HTMLElement): boolean {
      const evt = new Event('paste', { bubbles: true, cancelable: true });
      textarea.dispatchEvent(evt);
      return evt.defaultPrevented;
    }

    const blocked = render(
      <Harness experimentId="rr-paste/blocked">
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} />
      </Harness>,
    );
    expect(firePaste(screen.getByRole('textbox'))).toBe(true);
    blocked.unmount();

    render(
      <Harness experimentId="rr-paste/allowed">
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} allowPaste />
      </Harness>,
    );
    expect(firePaste(screen.getByRole('textbox'))).toBe(false);
  });

  it('falls back to LabPasteContext when no widget-level allowPaste is passed', () => {
    // Mirrors the production wiring: ExperimentRoute injects
    // `frontmatter.allowPaste` via LabPasteContext, and the rubric widget
    // (without its own allowPaste prop) must honour that lab-level default.
    function firePaste(textarea: HTMLElement): boolean {
      const evt = new Event('paste', { bubbles: true, cancelable: true });
      textarea.dispatchEvent(evt);
      return evt.defaultPrevented;
    }
    render(
      <LabPasteContext.Provider value={true}>
        <Harness experimentId="rr-paste/context">
          <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} />
        </Harness>
      </LabPasteContext.Provider>,
    );
    expect(firePaste(screen.getByRole('textbox'))).toBe(false);
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

describe('RubricResponse — tiered hints', () => {
  // Rubric with two required literal criteria sharing tier 1 (dedupe target)
  // and an optional literal criterion for the bonus panel. No semantic checks
  // so no embedder calls are needed.
  const tieredRubric = {
    id: 'tiered',
    version: 1,
    title: 'Tiered',
    criteria: [
      {
        id: 'iv',
        label: 'IV',
        hints: ['shared-t1', 'shared-t2', 'iv-t3'],
        any: [{ kind: 'literal', terms: ['uafhængig'] }],
      },
      {
        id: 'dv',
        label: 'DV',
        hints: ['shared-t1', 'shared-t2', 'dv-t3'],
        any: [{ kind: 'literal', terms: ['afhængig'] }],
      },
      {
        id: 'bonus',
        label: 'Bonus',
        required: false,
        hints: ['bonus-t1', 'bonus-t2'],
        any: [{ kind: 'literal', terms: ['ekstra'] }],
      },
    ],
  };
  const empty = new MockEmbedder({});

  it('reveals tier-1 hint after first failing tjek, deduped across criteria', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/1">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), 'svaret er ufuldstændigt her');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText('shared-t1')).toBeInTheDocument();
    // Only one bullet for the shared tier-1 hint — dedupe.
    expect(screen.getAllByText('shared-t1')).toHaveLength(1);
    // Tier 2/3 not yet revealed.
    expect(screen.queryByText('shared-t2')).not.toBeInTheDocument();
    expect(screen.queryByText('iv-t3')).not.toBeInTheDocument();
  });

  it('stacks hints tier 1 → 1+2 → 1+2+3 across repeated tjek, caps at 3', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/2">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    const button = screen.getByRole('button', { name: /tjek/i });
    await user.type(screen.getByRole('textbox'), 'svaret er ufuldstændigt her');

    await user.click(button);
    expect(await screen.findByText('shared-t1')).toBeInTheDocument();

    await user.click(button);
    expect(await screen.findByText('shared-t2')).toBeInTheDocument();
    expect(screen.getByText('shared-t1')).toBeInTheDocument();

    await user.click(button);
    expect(await screen.findByText('iv-t3')).toBeInTheDocument();
    expect(screen.getByText('dv-t3')).toBeInTheDocument();
    expect(screen.getByText('shared-t1')).toBeInTheDocument();
    expect(screen.getByText('shared-t2')).toBeInTheDocument();

    // Fourth click — caps; no new bullets.
    await user.click(button);
    expect(screen.getAllByText('iv-t3')).toHaveLength(1);
    expect(screen.getAllByText('dv-t3')).toHaveLength(1);
  });

  it('shows the bonus panel when required pass and the optional has tiered hints', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/3">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), 'min uafhængig og min afhængig variabel er klare');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByText(/vil du gøre svaret stærkere/i)).toBeInTheDocument();
    expect(screen.getByText('bonus-t1')).toBeInTheDocument();
    expect(screen.queryByText('bonus-t2')).not.toBeInTheDocument();
  });

  it('hides the bonus panel on required regression but preserves the tier', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/4">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    const textbox = screen.getByRole('textbox');
    await user.type(textbox, 'min uafhængig og min afhængig variabel er klare');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText('bonus-t1')).toBeInTheDocument();

    // Edit to break the dv keyword (replace "afhængig" → drop it entirely).
    await user.clear(textbox);
    await user.type(textbox, 'kun min uafhængig variabel er klar');
    await user.click(screen.getByRole('button', { name: /tjek/i }));

    // Required regression: bonus panel hides; required failure hint surfaces.
    await screen.findByText('shared-t1');
    expect(screen.queryByText(/vil du gøre svaret stærkere/i)).not.toBeInTheDocument();
    expect(screen.queryByText('bonus-t1')).not.toBeInTheDocument();

    // Re-pass required → bonus tier preserved across the regression cycle and
    // increments again on this new tjek with bonus still failing. If the tier
    // had been reset to 0 on regression, only bonus-t1 would surface here.
    await user.clear(textbox);
    await user.type(textbox, 'min uafhængig og min afhængig variabel er klare igen');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText('bonus-t2')).toBeInTheDocument();
    expect(screen.getByText('bonus-t1')).toBeInTheDocument();
  });

  it('does not escalate or render a semantic-only bonus while the embedder is down', async () => {
    // The bonus criterion is semantic-only; with a flaky embedder it goes
    // skipped-embedder → !evaluable. Required criteria are literal-only so
    // they still pass. The widget must not ratchet the bonus tier or show
    // the panel under the embedder-down banner.
    const semanticBonusRubric = {
      id: 'tiered-sem',
      version: 1,
      title: 'Sem bonus',
      criteria: [
        {
          id: 'iv',
          label: 'IV',
          hints: ['iv-t1'],
          any: [{ kind: 'literal', terms: ['uafhængig'] }],
        },
        {
          id: 'dv',
          label: 'DV',
          hints: ['dv-t1'],
          any: [{ kind: 'literal', terms: ['afhængig'] }],
        },
        {
          id: 'bonus',
          label: 'Bonus',
          required: false,
          hints: ['bonus-t1', 'bonus-t2'],
          any: [{ kind: 'semantic', threshold: 0.5, anchors: ['something'] }],
        },
      ],
    };
    const flaky = {
      async embed() {
        throw new Error('embed server down');
      },
    };
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/5">
        <RubricResponse id="hyp" prompt="?" rubric={semanticBonusRubric} embedder={flaky} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), 'min uafhængig og afhængig variabel');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    // Embedder-down banner shows; gate stays closed.
    expect(await screen.findByText(/semantiske vurdering/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    // No bonus panel surfaced — the criterion was skipped, not failing.
    expect(screen.queryByText(/vil du gøre svaret stærkere/i)).not.toBeInTheDocument();
    expect(screen.queryByText('bonus-t1')).not.toBeInTheDocument();
  });
});

describe('RubricResponse — reload safety', () => {
  it('restores the gate as passed when a prior pass is in widgetValues', async () => {
    const experimentId = 'rr-reload/1';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);

    const user = userEvent.setup();
    const first = render(
      <Harness experimentId={experimentId}>
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={mockEmbedder()} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    first.unmount();

    // Fresh mount with the same experimentId — state hydrates from
    // localStorage and the gate reports pass without re-clicking Tjek.
    render(
      <Harness experimentId={experimentId}>
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={mockEmbedder()} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    expect(screen.getByText(/godkendt/i)).toBeInTheDocument();
  });

  it('ignores the persisted pass when the rubric version bumps', async () => {
    const experimentId = 'rr-rubric-version/1';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);

    const user = userEvent.setup();
    const first = render(
      <Harness experimentId={experimentId}>
        <RubricResponse id="hypotese" prompt="?" rubric={passingRubric} embedder={mockEmbedder()} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');
    first.unmount();

    // Author bumps the rubric version (e.g. tightened threshold, new criterion).
    // The persisted record is now stale → gate must re-close until a fresh Tjek.
    const bumpedRubric = { ...passingRubric, version: passingRubric.version + 1 };
    render(
      <Harness experimentId={experimentId}>
        <RubricResponse id="hypotese" prompt="?" rubric={bumpedRubric} embedder={mockEmbedder()} />
      </Harness>,
    );
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    expect(screen.getByText(/ikke tjekket endnu/i)).toBeInTheDocument();
  });

  it('marks dirty + closes the gate when dependsOn changes after a pass', async () => {
    const experimentId = 'rr-deps/1';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);

    function Bound() {
      const [deps, setDeps] = useState('X|Y');
      return (
        <>
          <button type="button" data-testid="flip-deps" onClick={() => setDeps('m|F')}>
            flip
          </button>
          <RubricResponse
            id="hypotese"
            prompt="?"
            rubric={passingRubric}
            dependsOn={deps}
            embedder={mockEmbedder()}
          />
        </>
      );
    }

    const user = userEvent.setup();
    render(
      <Harness experimentId={experimentId}>
        <Bound />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    // Flip the external dep — text is unchanged, but the prior pass no longer
    // applies. Gate re-closes; "Ændret siden tjek" pill surfaces.
    await user.click(screen.getByTestId('flip-deps'));
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    expect(screen.getByText(/ændret siden tjek/i)).toBeInTheDocument();
  });
});
