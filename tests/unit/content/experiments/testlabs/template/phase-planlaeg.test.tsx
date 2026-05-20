// Real content modules — exercising the actual MDX-compiled phase bodies.
import * as template from '@/content/experiments/testlabs/template';
// Full-flow RTL test for the template lab's phase 1 (planlaeg). Mounts the
// real LabGuide with the real content modules; only the rubric embedder is
// swapped for a MockEmbedder so the test stays hermetic.
//
// Phase 1 now drives the whole flow from a SINGLE merged footer button that
// cycles through three states (merged-check-button): "Tjek variable" →
// "Tjek hypotese" → "Næste fase →". The two in-widget Tjek buttons no longer
// exist. The test walks: empty → fill IV/DV correctly → footer "Tjek variable"
// → reveal hypothesis → footer "Tjek hypotese" → rubric pass → footer
// "Næste fase →". Plus three negative paths.
import { LabGuide } from '@/lab-guide/LabGuide';
import { mdxComponents } from '@/lab-guide/widgets/mdx';
import { MDXProvider } from '@mdx-js/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Replace HttpEmbedder with a MockEmbedder. The rubric's required `relation`
// criterion is regex-only, so empty TEST_VECTORS is enough for the happy path —
// the optional `principle` criterion stays unsatisfied but does not block.
vi.mock('@/lib/rubric/embedder', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/rubric/embedder')>('@/lib/rubric/embedder');
  return {
    ...actual,
    HttpEmbedder: vi.fn().mockImplementation(() => new actual.MockEmbedder({})),
  };
});

function renderTemplate(experimentId: string) {
  const theory = <template.Theory />;
  const phaseBodies: Record<string, ReactNode> = Object.fromEntries(
    Object.entries(template.phaseBodies).map(([id, C]) => [id, <C key={id} />]),
  );
  return render(
    <MemoryRouter>
      <MDXProvider components={mdxComponents}>
        <LabGuide
          // Each test gets a fresh experimentId so localStorage from prior runs
          // doesn't bleed in via RunnerProvider's load().
          experiment={{ ...template.frontmatter, simulationId: '__none' }}
          topic={experimentId}
          topicTitle="Testlabs"
          slug="template"
          mode="guided"
          theory={theory}
          phaseBodies={phaseBodies}
          theoryOpen={false}
          onToggleTheory={vi.fn()}
          simOpen={false}
          onToggleSim={vi.fn()}
        />
      </MDXProvider>
    </MemoryRouter>,
  );
}

async function fillVariables(values: { ivSymbol: string; dvSymbol: string }) {
  const user = userEvent.setup();
  // The VariableTable widget uses the id `variables` per the template MDX —
  // so cell ids are stable. With per-section config, row indices live in
  // the cell id (`variables-iv0-*`, `variables-c0-*`).
  // Phase 1 now validates name + symbol + unit on every IV/DV/constant row
  // (requireUnits + expected.{name,symbol,unit} for IV/DV) and uses the
  // linear-equation example: IV/DV are generic xvar/yvar with uppercase
  // X/Y symbols, constants are hældning/skæringspunkt with lowercase a/b.
  await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'xvar');
  await user.type(
    document.getElementById('variables-iv0-symbol') as HTMLInputElement,
    values.ivSymbol,
  );
  await user.type(document.getElementById('variables-iv0-unit') as HTMLInputElement, 'ux');
  await user.type(document.getElementById('variables-dv0-name') as HTMLInputElement, 'yvar');
  await user.type(
    document.getElementById('variables-dv0-symbol') as HTMLInputElement,
    values.dvSymbol,
  );
  await user.type(document.getElementById('variables-dv0-unit') as HTMLInputElement, 'uy');
  await user.type(document.getElementById('variables-c0-name') as HTMLInputElement, 'hældning');
  await user.type(document.getElementById('variables-c0-symbol') as HTMLInputElement, 'a');
  await user.type(document.getElementById('variables-c0-unit') as HTMLInputElement, 'ua');
  await user.type(
    document.getElementById('variables-c1-name') as HTMLInputElement,
    'skæringspunkt',
  );
  await user.type(document.getElementById('variables-c1-symbol') as HTMLInputElement, 'b');
  await user.type(document.getElementById('variables-c1-unit') as HTMLInputElement, 'ub');
}

// The merged footer button — the only Tjek/Næste control in phase 1. Its
// accessible name is whichever of the three states is active; the regex
// matches all of them so the same query works across the whole flow.
function footerButton(): HTMLButtonElement {
  return screen.getByRole('button', {
    name: /tjek variable|tjek hypotese|tjekker|næste fase/i,
  }) as HTMLButtonElement;
}

beforeEach(() => {
  // The lab persists to localStorage on every state change — wipe between
  // tests so each starts from `empty`.
  window.localStorage.clear();
});

describe('template phase 1 — happy path', () => {
  it('cycles the footer button: Tjek variable → Tjek hypotese → Næste fase', async () => {
    const user = userEvent.setup();
    renderTemplate('happy-path');

    // State 1: the merged button shows "Tjek variable" and is enabled (the
    // VariableTable check is synchronous — never disabled).
    expect(footerButton()).toHaveTextContent(/tjek variable/i);
    expect(footerButton()).not.toBeDisabled();
    // No in-widget Tjek buttons exist any more.
    expect(
      screen.queryByRole('button', { name: /tjek mine variable/i }),
    ).not.toBeInTheDocument();

    await fillVariables({ ivSymbol: 'X', dvSymbol: 'Y' });
    // Variables filled correctly but not yet checked — strict RevealWhen hides
    // the hypothesis section, and the button stays on "Tjek variable".
    expect(document.getElementById('rr-hypotese')).toBeNull();
    expect(footerButton()).toHaveTextContent(/tjek variable/i);

    await user.click(footerButton());
    // The table reports correct → strict RevealWhen shows the hypothesis, the
    // RubricResponse registers its footer check, and state 2 takes over.
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeInTheDocument());
    await waitFor(() => expect(footerButton()).toHaveTextContent(/tjek hypotese/i));
    // State 2 is disabled until the hypothesis clears the minWords floor.
    expect(footerButton()).toBeDisabled();

    const textarea = document.getElementById('rr-hypotese') as HTMLTextAreaElement;
    await user.type(
      textarea,
      'Når X stiger, forventer jeg, at Y stiger lineært med X i denne lab.',
    );
    await waitFor(() => expect(footerButton()).not.toBeDisabled());

    await user.click(footerButton());
    // Rubric eval resolves → both gate widgets satisfied → state 3.
    await waitFor(() => expect(footerButton()).toHaveTextContent(/næste fase/i));
    expect(footerButton()).not.toBeDisabled();
  });
});

describe('template phase 1 — negative paths', () => {
  it('lowercase symbols: footer stays on "Tjek variable" with case-mismatch hints', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/lowercase');

    // Canonical IV/DV symbols are uppercase X/Y; lowercase x/y trips the
    // case-mismatch ladder (precedence wins over the lowercase commonMistake).
    await fillVariables({ ivSymbol: 'x', dvSymbol: 'y' });
    await user.click(footerButton());
    expect(
      screen.getAllByText(/tjek dette symbol — er stort\/lille bogstav rigtigt\?/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(document.getElementById('rr-hypotese')).toBeNull();
    // The table never reported correct → the button stays on state 1.
    expect(footerButton()).toHaveTextContent(/tjek variable/i);
  });

  it('empty symbols: footer stays on "Tjek variable" with "feltet er tomt" hints', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/empty');

    // Type only names; leave symbols empty.
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'Force');
    await user.type(
      document.getElementById('variables-dv0-name') as HTMLInputElement,
      'Acceleration',
    );
    await user.click(footerButton());
    expect(screen.getAllByText(/dette felt er tomt/i).length).toBeGreaterThanOrEqual(1);
    expect(document.getElementById('rr-hypotese')).toBeNull();
    expect(footerButton()).toHaveTextContent(/tjek variable/i);
  });

  it('edit a cell after reaching "Tjek hypotese": footer reverts to "Tjek variable"', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/edit-after-pass');

    await fillVariables({ ivSymbol: 'X', dvSymbol: 'Y' });
    await user.click(footerButton());
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeInTheDocument());
    await waitFor(() => expect(footerButton()).toHaveTextContent(/tjek hypotese/i));

    // Edit an IV cell — strict RevealWhen hides the section, `clearOnHide`
    // clears `hypotese`, RubricResponse unmounts and its footer check is
    // unregistered (the deliberate unmount cleanup) → the footer walk stops
    // at `variables` and the button reverts to state 1.
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'Z');
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeNull());
    await waitFor(() => expect(footerButton()).toHaveTextContent(/tjek variable/i));
  });
});
