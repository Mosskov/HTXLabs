import { HintSpendProvider } from '@/lab-guide/HintSpendContext';
import { PhaseScopeProvider } from '@/lab-guide/PhaseScopeContext';
import { RunnerProvider, useRunner } from '@/lab-guide/RunnerContext';
import { isGateSatisfied } from '@/lab-guide/gates';
import { HintBucket } from '@/lab-guide/widgets/HintBucket';
import { LabPasteContext } from '@/lab-guide/widgets/ProtectedInput';
import { RubricResponse } from '@/lab-guide/widgets/RubricResponse';
import { MockEmbedder } from '@/lib/rubric/embedder';
import type { Gate, Phase } from '@/lib/schema';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

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
    // Re-query the button each time: below the floor it is wrapped in a hover
    // Tooltip (carrying the min-words hint), which remounts the element — a
    // stale reference held across the transition would point at dead DOM.
    // Below the floor it is aria-disabled (focusable, so the tooltip can open),
    // not carrying a real `disabled` attribute.
    expect(screen.getByRole('button', { name: /tjek/i })).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByRole('textbox'), 'one two three four five');
    expect(screen.getByRole('button', { name: /tjek/i })).not.toHaveAttribute('aria-disabled');
  });

  it('blocks the check above the maxWords ceiling, with a counter and tooltip', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr-maxwords/1">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          maxWords={3}
          embedder={mockEmbedder()}
        />
      </Harness>,
    );
    const textbox = screen.getByRole('textbox');

    // At the ceiling — counter shows, check still allowed.
    await user.type(textbox, 'one two three');
    expect(screen.getByText('3 / 3 ord')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tjek/i })).not.toHaveAttribute('aria-disabled');

    // Over the ceiling — check blocked (aria-disabled), reason in the tooltip.
    await user.type(textbox, ' four');
    expect(screen.getByText('4 / 3 ord')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tjek/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/skriv højst 3 ord/i)).toHaveAttribute('role', 'tooltip');
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
    expect(await screen.findByRole('status')).toHaveTextContent(/godkendt/i);
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
    expect(await screen.findByRole('status')).toHaveTextContent(/godkendt/i);
    expect(screen.getByTestId('gate')).toHaveTextContent('pass');

    // Edit one character → dirty → gate re-closes, sr-only "Godkendt" unmounts.
    await user.type(screen.getByRole('textbox'), '!');
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

  it('does NOT auto-reveal any hint tier on Tjek (request-driven model)', async () => {
    // Old behaviour was to auto-bump every failing criterion's tier counter on
    // Tjek. The new request-driven system only reveals tiers when the student
    // arms spend mode + clicks a lightbulb — Tjek by itself surfaces nothing.
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/1">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), 'svaret er ufuldstændigt her');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(screen.queryByText('shared-t1')).not.toBeInTheDocument();
    expect(screen.queryByText('shared-t2')).not.toBeInTheDocument();
    expect(screen.queryByText('iv-t3')).not.toBeInTheDocument();
  });

  it('does not surface any optional/bonus criterion content on Tjek', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rrt/3">
        <RubricResponse id="hyp" prompt="?" rubric={tieredRubric} embedder={empty} />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), 'min uafhængig og min afhængig variabel er klare');
    await user.click(screen.getByRole('button', { name: /tjek/i }));
    expect(await screen.findByText(/godkendt/i)).toBeInTheDocument();
    // No automatic bonus surface — the student would have to spend tokens on
    // the optional criterion to see its tier-1 text.
    expect(screen.queryByText('bonus-t1')).not.toBeInTheDocument();
    expect(screen.queryByText('bonus-t2')).not.toBeInTheDocument();
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

describe('RubricResponse — panel + spend (F9)', () => {
  // Three criteria laid out so the spend-mode integration can exercise the
  // author-priority walk: relation (3 tiers + misconception), variables
  // (2 tiers), shape (optional, 1 tier).
  const panelRubric = {
    id: 'panel-int',
    version: 1,
    title: 'Panel integration',
    criteria: [
      {
        id: 'relation',
        label: 'Relation',
        hints: ['rel-t1', 'rel-t2', 'rel-t3'],
        any: [{ kind: 'literal', terms: ['stiger'] }],
        misconceptions: [
          { kind: 'regex', pattern: 'pendul', flags: 'iu', hint: 'mis-pendul' },
        ],
      },
      {
        id: 'variables',
        label: 'Variable',
        hints: ['var-t1', 'var-t2'],
        any: [{ kind: 'literal', terms: ['x'] }],
      },
      {
        id: 'shape',
        label: 'Lineær',
        required: false,
        hints: ['shape-t1'],
        any: [{ kind: 'literal', terms: ['lineær'] }],
      },
    ],
  };

  function IntegrationHarness({
    experimentId,
    children,
  }: {
    experimentId: string;
    children: React.ReactNode;
  }) {
    return (
      <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[phase]}>
        <HintSpendProvider>
          <PhaseScopeProvider phaseId="p">{children}</PhaseScopeProvider>
          <GateProbe />
        </HintSpendProvider>
      </RunnerProvider>
    );
  }

  // T1: nothing visible until first Tjek + first interaction.
  it('initial render: no panel, no pip, no inline HintBucket', () => {
    render(
      <IntegrationHarness experimentId="rr-f9/init">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    expect(screen.queryByText(/Tips/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint-pulje/i })).not.toBeInTheDocument();
    // Pip-toggle button never appears before any panel content surfaces.
    expect(screen.queryByRole('button', { name: /hint-panel/i })).not.toBeInTheDocument();
  });

  // T2: failing Tjek without a triggered misconception → panel still hidden.
  // Wait via the Tjek button's `Tjekker…` label cycling back to the idle label.
  it('failing Tjek with no misconception: panel does not materialize', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/no-mis">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    await user.type(screen.getByRole('textbox'), 'svaret er ufuldstændigt her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    // After the async evaluate settles the gate flips to 'fail' (widgetId
    // 'hyp' doesn't match the gate's 'hypotese', so gate stays 'fail' — but
    // that's also exactly what we want: just confirm the eval settled.)
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));
    expect(
      screen.queryByRole('region', { name: /tips til de manglende krav/i }),
    ).not.toBeInTheDocument();
  });

  // T3: failing Tjek with a misconception → panel renders w/ amber bullet, no
  // verdict-reveal pill (failing ladders aren't at cap yet).
  it('failing Tjek with misconception: panel materializes with the misconception', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/mis">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    await user.type(screen.getByRole('textbox'), 'pendul svinger frem og tilbage tydeligt');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    expect(await screen.findByText('mis-pendul')).toBeInTheDocument();
    // Panel region materialized (its aria-label is the stable signal — the
    // visible 'Tips' header was removed; border colour carries the affordance).
    expect(
      screen.getByRole('region', { name: /tips til de manglende krav/i }),
    ).toBeInTheDocument();
  });

  // T4 + T5: arm bucket + click textarea → first failing criterion's tier 1
  // appears as a slate bullet. Strict per-group gating: a second spend on
  // the same text still targets relation (the first failing criterion),
  // never advances to variables until relation is satisfied.
  it('armed-click on textarea spends the next paid tier on the first failing criterion (strict gating)', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/walk">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'svar uden krav opfyldt her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    // Wait for failing Tjek to flush so spendable-count registers + bucket is
    // armable.
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));

    const bucket = await screen.findByRole('button', { name: /hint-pulje:\s*3\s*af\s*3/i });
    // First arm + click textarea → relation tier 1
    await user.click(bucket);
    await user.click(textarea);
    expect(await screen.findByText('rel-t1')).toBeInTheDocument();
    expect(screen.queryByText('rel-t2')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hint-pulje:\s*2\s*af\s*3/i })).toBeInTheDocument();

    // Second spend → relation tier 2 (same criterion still has remaining cap).
    await user.click(screen.getByRole('button', { name: /hint-pulje/i }));
    await user.click(textarea);
    expect(await screen.findByText('rel-t2')).toBeInTheDocument();
  });

  // Vacuous-true guard: a fully-passing rubric with no triggered
  // misconceptions leaves the panel hidden — no failing-with-spent-hints
  // criterion AND no pinned errors means hasContent === false.
  it('fully-passing rubric with no misconceptions: panel does not render', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/pass">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={panelRubric}
          embedder={new MockEmbedder({})}
        />
      </IntegrationHarness>,
    );
    // Hit BOTH required criteria literally: 'stiger' + 'x'.
    await user.type(screen.getByRole('textbox'), 'når x stiger så y vokser i en bestemt takt');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('pass'));
    expect(
      screen.queryByRole('region', { name: /tips til de manglende krav/i }),
    ).not.toBeInTheDocument();
  });

  // Strict gating: once the first failing criterion's ladder is capped, the
  // HintBucket's spendable count drops to 0 (later criteria are unreachable)
  // and arming the bucket no longer fires spend-mode against the textarea.
  it('strict gating: capped first-failing criterion blocks further spend even with tokens + a later failing criterion', async () => {
    const bigPoolPhase: Phase = { id: 'p', title: 'P', gate, hintPoolSize: 10 };
    function BigPoolHarness({
      experimentId,
      children,
    }: {
      experimentId: string;
      children: React.ReactNode;
    }) {
      return (
        <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[bigPoolPhase]}>
          <HintSpendProvider>
            <PhaseScopeProvider phaseId="p">{children}</PhaseScopeProvider>
            <GateProbe />
          </HintSpendProvider>
        </RunnerProvider>
      );
    }
    const user = userEvent.setup();
    render(
      <BigPoolHarness experimentId="rr-f9/strict-cap">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </BigPoolHarness>,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'svar uden krav opfyldt her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));

    // Spend relation's 3 tiers — they all target the first failing criterion.
    for (let i = 0; i < 3; i++) {
      const bucket = await screen.findByRole('button', { name: /hint-pulje/i });
      await user.click(bucket);
      await user.click(textarea);
    }
    expect(await screen.findByText('rel-t3')).toBeInTheDocument();
    // The deepest hint of a capped ladder carries the ➔ active-step glyph.
    expect(screen.getByText('➔')).toBeInTheDocument();

    // Bucket now reads "no targets" — relation is capped, variables is
    // unreachable until relation is satisfied. The bucket stays in the DOM
    // (tokens > 0) but is rendered aria-disabled with the no-targets tooltip.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /hint-pulje/i })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    // Clicking the disabled bucket + the textarea does NOT reveal var-t1.
    await user.click(screen.getByRole('button', { name: /hint-pulje/i }));
    await user.click(textarea);
    expect(screen.queryByText('var-t1')).not.toBeInTheDocument();
  });

  // Active-group identity: B has spent hints, but the student then breaks A
  // (now failing with tier === 0). Retjek: panel hides B's stack and shows
  // only common-errors / nothing extra until the student spends on A.
  it('active-group identity: regressing earlier criterion drops later spent hints from the panel', async () => {
    const bigPoolPhase: Phase = { id: 'p', title: 'P', gate, hintPoolSize: 10 };
    function BigPoolHarness({
      experimentId,
      children,
    }: {
      experimentId: string;
      children: React.ReactNode;
    }) {
      return (
        <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[bigPoolPhase]}>
          <HintSpendProvider>
            <PhaseScopeProvider phaseId="p">{children}</PhaseScopeProvider>
            <GateProbe />
          </HintSpendProvider>
        </RunnerProvider>
      );
    }
    const user = userEvent.setup();
    render(
      <BigPoolHarness experimentId="rr-f9/active-group">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </BigPoolHarness>,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    // Phase 1: satisfy relation literally ('stiger') so variables becomes the
    // first failing criterion. Spend a tier on variables.
    await user.type(textarea, 'noget stiger her men ingen variabel nævnes endnu');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    // Relation passes (contains 'stiger'); variables fails (no 'x'). Spend.
    const bucket1 = await screen.findByRole('button', { name: /hint-pulje/i });
    await user.click(bucket1);
    await user.click(textarea);
    expect(await screen.findByText('var-t1')).toBeInTheDocument();

    // Phase 2: edit the text so relation breaks ('stiger' removed) AND
    // variables also still fails. Retjek.
    await user.clear(textarea);
    await user.type(textarea, 'svaret nævner ikke længere nogen relation eller variabel her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));

    // Relation is now first-failing again with tier === 0; the panel's
    // active stack hides — variables' spent hint must NOT leak in.
    await waitFor(() => expect(screen.queryByText('var-t1')).not.toBeInTheDocument());
  });

  // Flat-panel render contract: misconceptions at top, paid hints
  // newest-on-top, no criterion-label header in the panel.
  it('flat-panel contract: misconceptions render before paid hints, newest-on-top, no label header', async () => {
    const bigPoolPhase: Phase = { id: 'p', title: 'P', gate, hintPoolSize: 10 };
    function BigPoolHarness({
      experimentId,
      children,
    }: {
      experimentId: string;
      children: React.ReactNode;
    }) {
      return (
        <RunnerProvider experimentId={experimentId} experimentVersion={1} phases={[bigPoolPhase]}>
          <HintSpendProvider>
            <PhaseScopeProvider phaseId="p">{children}</PhaseScopeProvider>
            <GateProbe />
          </HintSpendProvider>
        </RunnerProvider>
      );
    }
    const user = userEvent.setup();
    render(
      <BigPoolHarness experimentId="rr-f9/flat">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </BigPoolHarness>,
    );
    const textarea = screen.getByRole('textbox');
    // Trigger the 'pendul' misconception on relation; relation still failing
    // (no 'stiger'). Spend two tiers on relation.
    await user.type(textarea, 'pendul nævnes uden relation eller variabel her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await screen.findByText('mis-pendul');
    for (let i = 0; i < 2; i++) {
      const bucket = await screen.findByRole('button', { name: /hint-pulje/i });
      await user.click(bucket);
      await user.click(textarea);
    }
    await screen.findByText('rel-t2');

    const panel = screen.getByRole('region', { name: /tips til de manglende krav/i });
    const text = panel.textContent ?? '';
    // (a) Misconception appears before any paid hint in DOM order.
    expect(text.indexOf('mis-pendul')).toBeLessThan(text.indexOf('rel-t1'));
    expect(text.indexOf('mis-pendul')).toBeLessThan(text.indexOf('rel-t2'));
    // (b) tier-2 hint appears before tier-1 (newest-on-top).
    expect(text.indexOf('rel-t2')).toBeLessThan(text.indexOf('rel-t1'));
    // (c) No criterion-label header in the panel.
    expect(text).not.toContain('Relation');
  });

  // Pip-toggle: clicking the pip cluster collapses the panel; clicking again
  // reopens. A spend forces the panel back open. The collapsed bit persists
  // via widgetValues so phase nav + reload preserve it.
  it('pip-toggle: collapses + reopens the panel; spend forces reopen; state persists', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/pip-toggle">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'pendul svinger frem og tilbage tydeligt');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await screen.findByText('mis-pendul');
    expect(
      screen.getByRole('region', { name: /tips til de manglende krav/i }),
    ).toBeInTheDocument();

    // Click pip-toggle to collapse — pips stay; panel region unmounts.
    const pipToggle = screen.getByRole('button', { name: /skjul hint-panel/i });
    await user.click(pipToggle);
    expect(
      screen.queryByRole('region', { name: /tips til de manglende krav/i }),
    ).not.toBeInTheDocument();
    // Aria-label flips to the show variant + pip count.
    expect(screen.getByRole('button', { name: /vis hint-panel/i })).toBeInTheDocument();

    // Click again → panel reopens.
    await user.click(screen.getByRole('button', { name: /vis hint-panel/i }));
    expect(
      screen.getByRole('region', { name: /tips til de manglende krav/i }),
    ).toBeInTheDocument();

    // Collapse again, then spend a tier — panel auto-reopens.
    await user.click(screen.getByRole('button', { name: /skjul hint-panel/i }));
    const bucket = await screen.findByRole('button', { name: /hint-pulje/i });
    await user.click(bucket);
    await user.click(textarea);
    await screen.findByText('rel-t1');
    expect(
      screen.getByRole('region', { name: /tips til de manglende krav/i }),
    ).toBeInTheDocument();
  });

  // Persistence of the collapsed bit across remount (mirrors panelShown).
  it('pip-toggle collapsed bit persists across remount', async () => {
    const experimentId = 'rr-f9/collapse-persist';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);
    const user = userEvent.setup();
    const first = render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    await user.type(
      screen.getByRole('textbox'),
      'pendul svinger frem og tilbage tydeligt',
    );
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await screen.findByText('mis-pendul');
    await user.click(screen.getByRole('button', { name: /skjul hint-panel/i }));
    first.unmount();

    render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    // Panel stays collapsed after reload — pip-toggle aria-label is the
    // collapse-side copy.
    expect(screen.getByRole('button', { name: /vis hint-panel/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: /tips til de manglende krav/i }),
    ).not.toBeInTheDocument();
  });

  // Content-driven visibility: `panelShown` stays sticky-once, but the panel
  // body only renders when there's something to show. After the misconception
  // resolves and no paid hints have been spent, the panel hides — preventing
  // the "empty box on satisfy" failure mode noted in the D3 prototype.
  it('content-driven panel: edit that clears the misconception (with no spent hints) hides the panel', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/sticky">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'pendul svinger frem og tilbage tydeligt');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await screen.findByText('mis-pendul');

    // Replace the text so the misconception no longer triggers — and Tjek
    // again. With no spent hints on the active group, the panel has no
    // content and hides itself even though `panelShown` is still true.
    await user.clear(textarea);
    await user.type(textarea, 'svaret er nu uden problematiske ord');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.queryByText('mis-pendul')).not.toBeInTheDocument());
    expect(
      screen.queryByRole('region', { name: /tips til de manglende krav/i }),
    ).not.toBeInTheDocument();
  });

  // T19: paid bullet survives a dirty edit — was the F9 failure mode in the
  // old focus-popup model.
  it('paid bullet survives a dirty edit (no Tjek): panel + bullet remain in DOM', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/dirty-keeps-bullet">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'svar uden krav opfyldt her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));

    // Spend one tier.
    const bucket = await screen.findByRole('button', { name: /hint-pulje/i });
    await user.click(bucket);
    await user.click(textarea);
    expect(await screen.findByText('rel-t1')).toBeInTheDocument();

    // Now edit the textarea (no fresh Tjek). The result is `dirty`, but the
    // paid bullet must NOT vanish — that's the F9 fix.
    await user.type(textarea, ' yderligere tekst');
    expect(screen.getByText('rel-t1')).toBeInTheDocument();
  });

  // C7: bullets survive remount via the persisted panel-entries snapshot.
  // The misconception path exercises the evaluate-time write.
  it('panel bullets survive remount via the persisted snapshot (C7 evaluate write)', async () => {
    const experimentId = 'rr-f9-c7/mis';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);

    const user = userEvent.setup();
    const first = render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    await user.type(screen.getByRole('textbox'), 'pendul svinger frem og tilbage tydeligt');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    expect(await screen.findByText('mis-pendul')).toBeInTheDocument();
    first.unmount();

    // Fresh mount with the same experimentId — snapshot rehydrates the
    // bullet without needing to re-Tjek (result is null on remount; the
    // panelEntries fallback reads from widgetValues).
    render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
      </IntegrationHarness>,
    );
    expect(screen.getByText('mis-pendul')).toBeInTheDocument();
  });

  // C7: paid bullet survives remount. Exercises the spend-time write so a
  // student who navigates away after revealing a tier finds it on return.
  it('paid bullet survives remount via the snapshot (C7 spend write)', async () => {
    const experimentId = 'rr-f9-c7/paid';
    localStorage.removeItem(`htxlabs:state:${experimentId}`);

    const user = userEvent.setup();
    const first = render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'svar uden krav opfyldt her');
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));

    const bucket = await screen.findByRole('button', { name: /hint-pulje/i });
    await user.click(bucket);
    await user.click(textarea);
    expect(await screen.findByText('rel-t1')).toBeInTheDocument();
    first.unmount();

    render(
      <IntegrationHarness experimentId={experimentId}>
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    expect(screen.getByText('rel-t1')).toBeInTheDocument();
  });

  // T16: armed Enter on the textarea spends without inserting a newline.
  it('armed Enter spends and does NOT insert a newline into the textarea', async () => {
    const user = userEvent.setup();
    render(
      <IntegrationHarness experimentId="rr-f9/enter">
        <RubricResponse id="hyp" prompt="?" rubric={panelRubric} embedder={new MockEmbedder({})} />
        <HintBucket placement="footer" />
      </IntegrationHarness>,
    );
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const initialText = 'svar uden krav opfyldt her';
    await user.type(textarea, initialText);
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    await waitFor(() => expect(screen.getByTestId('gate')).toHaveTextContent('fail'));

    // Arm the bucket, focus the textarea, press Enter.
    await user.click(await screen.findByRole('button', { name: /hint-pulje/i }));
    textarea.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('rel-t1')).toBeInTheDocument();
    // Newline must NOT have been inserted by the textarea default.
    expect(textarea.value).toBe(initialText);
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
    // sr-only success status no longer mounts after the version bump.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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
    // applies. Gate re-closes; sr-only "Godkendt" unmounts.
    await user.click(screen.getByTestId('flip-deps'));
    expect(screen.getByTestId('gate')).toHaveTextContent('fail');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('RubricResponse — checkInFooter (footer-driven check)', () => {
  // Reads the runner's footer-check registry + exposes buttons to invoke it,
  // standing in for the PhaseFooter the widget would normally be driven by.
  function RubricCheckProbe() {
    const { widgetChecks } = useRunner();
    const check = widgetChecks.hypotese;
    return (
      <div>
        <span data-testid="rc-label">{check?.label ?? '(none)'}</span>
        <span data-testid="rc-pending">{String(check?.pending ?? false)}</span>
        <span data-testid="rc-disabled">{String(check?.disabled ?? true)}</span>
        <button type="button" data-testid="rc-run" onClick={() => check?.run()}>
          run
        </button>
        <button
          type="button"
          data-testid="rc-run2"
          onClick={() => {
            check?.run();
            check?.run();
          }}
        >
          run twice
        </button>
      </div>
    );
  }

  /** An embedder whose single `embed` call stays pending until `release`. */
  function deferredEmbedder() {
    let resolve: ((v: number[][]) => void) | undefined;
    const embed = vi.fn(
      () =>
        new Promise<number[][]>((res) => {
          resolve = res;
        }),
    );
    return {
      embedder: { embed },
      embed,
      release: (v: number[][]) => resolve?.(v),
    };
  }

  it('suppresses the in-widget button and registers a footer check', () => {
    render(
      <Harness experimentId="rr-footer/1">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          checkInFooter
          embedder={mockEmbedder()}
        />
        <RubricCheckProbe />
      </Harness>,
    );
    expect(screen.queryByRole('button', { name: /tjek mit svar/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('rc-label')).toHaveTextContent('Tjek mit svar');
  });

  it('without checkInFooter: keeps the in-widget button, registers no footer check', () => {
    render(
      <Harness experimentId="rr-footer/2">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          embedder={mockEmbedder()}
        />
        <RubricCheckProbe />
      </Harness>,
    );
    expect(screen.getByRole('button', { name: /tjek mit svar/i })).toBeInTheDocument();
    expect(screen.getByTestId('rc-label')).toHaveTextContent('(none)');
  });

  it('the registered check disabled tracks the minWords floor', async () => {
    const user = userEvent.setup();
    render(
      <Harness experimentId="rr-footer/3">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          minWords={5}
          checkInFooter
          embedder={mockEmbedder()}
        />
        <RubricCheckProbe />
      </Harness>,
    );
    expect(screen.getByTestId('rc-disabled')).toHaveTextContent('true');
    await user.type(screen.getByRole('textbox'), 'one two three four five');
    expect(screen.getByTestId('rc-disabled')).toHaveTextContent('false');
  });

  it('the registered check label + pending track the async evaluation', async () => {
    const user = userEvent.setup();
    const { embedder, release } = deferredEmbedder();
    render(
      <Harness experimentId="rr-footer/4">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          checkInFooter
          embedder={embedder}
        />
        <RubricCheckProbe />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);
    expect(screen.getByTestId('rc-label')).toHaveTextContent('Tjek mit svar');

    await user.click(screen.getByTestId('rc-run'));
    // While the eval is in flight the registered label flips to the pending
    // copy — proving the `pending`-derived `revision` re-fires registration.
    await waitFor(() => expect(screen.getByTestId('rc-pending')).toHaveTextContent('true'));
    expect(screen.getByTestId('rc-label')).toHaveTextContent('Tjekker…');

    release([
      [1, 0],
      [1, 0],
    ]);
    await waitFor(() => expect(screen.getByTestId('rc-pending')).toHaveTextContent('false'));
  });

  it('a synchronous double run() triggers only one evaluation (pendingRef guard)', async () => {
    const user = userEvent.setup();
    const { embedder, embed, release } = deferredEmbedder();
    render(
      <Harness experimentId="rr-footer/5">
        <RubricResponse
          id="hypotese"
          prompt="?"
          rubric={passingRubric}
          checkInFooter
          embedder={embedder}
        />
        <RubricCheckProbe />
      </Harness>,
    );
    await user.type(screen.getByRole('textbox'), passingText);

    // The probe fires run() twice synchronously in one click handler. The
    // re-entry guard must drop the second call → evaluateRubric runs once →
    // its single batched embed call fires exactly once.
    await user.click(screen.getByTestId('rc-run2'));
    expect(embed).toHaveBeenCalledTimes(1);

    // Release the in-flight evaluation so the component settles cleanly.
    release([
      [1, 0],
      [1, 0],
    ]);
    await waitFor(() => expect(screen.getByTestId('rc-pending')).toHaveTextContent('false'));
  });
});
