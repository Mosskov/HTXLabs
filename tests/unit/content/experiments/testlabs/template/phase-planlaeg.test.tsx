// Real content modules — exercising the actual MDX-compiled phase bodies.
import * as template from '@/content/experiments/testlabs/template';
// Full-flow RTL test for the template lab's phase 1 (planlaeg). Mounts the
// real LabGuide with the real content modules; only the rubric embedder is
// swapped for a MockEmbedder so the test stays hermetic.
//
// Walks through: empty → fill IV/DV correctly → assert hypothesis still hidden
// (snapshot-gated correct) → Tjek variables → reveal → write hypothesis →
// Tjek rubric → gate opens → Next enabled. Plus three negative paths.
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
  await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'Force');
  await user.type(
    document.getElementById('variables-iv0-symbol') as HTMLInputElement,
    values.ivSymbol,
  );
  await user.type(
    document.getElementById('variables-dv0-name') as HTMLInputElement,
    'Acceleration',
  );
  await user.type(
    document.getElementById('variables-dv0-symbol') as HTMLInputElement,
    values.dvSymbol,
  );
  // Phase 1 now requires the student to identify two constants too.
  await user.type(
    document.getElementById('variables-c0-name') as HTMLInputElement,
    'tyngdeacceleration',
  );
  await user.type(document.getElementById('variables-c0-symbol') as HTMLInputElement, 'g');
  await user.type(document.getElementById('variables-c0-unit') as HTMLInputElement, 'm/s²');
  await user.type(document.getElementById('variables-c1-name') as HTMLInputElement, 'masse');
  await user.type(document.getElementById('variables-c1-symbol') as HTMLInputElement, 'm');
  await user.type(document.getElementById('variables-c1-unit') as HTMLInputElement, 'kg');
}

function nextButton() {
  return screen.getByRole('button', { name: /næste fase/i });
}

beforeEach(() => {
  // The lab persists to localStorage on every state change — wipe between
  // tests so each starts from `empty`.
  window.localStorage.clear();
});

describe('template phase 1 — happy path', () => {
  it('opens the gate after filling variables, Tjek, hypothesis, rubric Tjek', async () => {
    const user = userEvent.setup();
    renderTemplate('happy-path');

    expect(nextButton()).toBeDisabled();

    await fillVariables({ ivSymbol: 'X', dvSymbol: 'Y' });
    // Variables filled correctly but Tjek not yet clicked — strict RevealWhen
    // hides the hypothesis section.
    expect(document.getElementById('rr-hypotese')).toBeNull();
    expect(nextButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getByText('Godkendt')).toBeInTheDocument();
    // Hypothesis section appears.
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeInTheDocument());

    // Write a hypothesis that clears both minWords (10) and the relation regex
    // (a short word adjacent to "stiger").
    const textarea = document.getElementById('rr-hypotese') as HTMLTextAreaElement;
    await user.type(
      textarea,
      'Når X stiger, forventer jeg, at Y stiger lineært med X i denne lab.',
    );
    await user.click(screen.getByRole('button', { name: /tjek mit svar/i }));
    // Wait for the rubric evaluation to resolve and the gate to flip.
    await waitFor(() => expect(nextButton()).not.toBeDisabled());
  });
});

describe('template phase 1 — negative paths', () => {
  it('lowercase symbols: Tjek shows commonMistake hints, hypothesis stays hidden', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/lowercase');

    await fillVariables({ ivSymbol: 'x', dvSymbol: 'y' });
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    // Generic case-mismatch hint for lowercase letters (since case-mismatch
    // wins over common-mistake refinement, the case-mismatch ladder fires).
    expect(
      screen.getAllByText(/tjek dette symbol — er stort\/lille bogstav rigtigt\?/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(document.getElementById('rr-hypotese')).toBeNull();
    expect(nextButton()).toBeDisabled();
  });

  it('empty symbols: Tjek shows "Dette felt er tomt." hints, hypothesis stays hidden', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/empty');

    // Type only names; leave symbols empty.
    await user.type(document.getElementById('variables-iv0-name') as HTMLInputElement, 'Force');
    await user.type(
      document.getElementById('variables-dv0-name') as HTMLInputElement,
      'Acceleration',
    );
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    expect(screen.getAllByText(/dette felt er tomt/i).length).toBeGreaterThanOrEqual(1);
    expect(document.getElementById('rr-hypotese')).toBeNull();
    expect(nextButton()).toBeDisabled();
  });

  it('edit a cell after a passing Tjek: hypothesis hides + Next re-locks', async () => {
    const user = userEvent.setup();
    renderTemplate('negative/edit-after-pass');

    await fillVariables({ ivSymbol: 'X', dvSymbol: 'Y' });
    await user.click(screen.getByRole('button', { name: /tjek mine variable/i }));
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeInTheDocument());

    // Now edit an IV cell — strict RevealWhen must hide the section again.
    await user.type(document.getElementById('variables-iv0-symbol') as HTMLInputElement, 'Z');
    await waitFor(() => expect(document.getElementById('rr-hypotese')).toBeNull());
    expect(nextButton()).toBeDisabled();
  });
});
