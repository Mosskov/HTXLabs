// Covers the mode-switch confirm/wipe semantics added 2026-05-14 — different-mode clicks confirm when saved state is meaningful and wipe before delegating.
import { ModePicker } from '@/lab-guide/ModePicker';
import { load } from '@/lab-guide/runner';
import { strings } from '@/lab-guide/strings.da';
import type { ExperimentFrontmatter, Phase } from '@/lib/schema';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const phases: Record<'guided' | 'open', Phase[]> = {
  guided: [
    { id: 'planlaeg', title: 'P1', gate: { type: 'always' } },
    { id: 'maal', title: 'P2', gate: { type: 'always' } },
  ],
  open: [
    { id: 'planlaeg', title: 'P1', gate: { type: 'always' } },
    { id: 'maal', title: 'P2', gate: { type: 'always' } },
  ],
};

const experiment: ExperimentFrontmatter = {
  version: 1,
  title: 'Test',
  simulationId: '__none',
  learningObjectives: ['x'],
  keyConcepts: [],
  difficulty: 'c-level',
  modes: { guided: { phases: phases.guided }, open: { phases: phases.open } },
  labModes: { virtual: { enabled: true } },
  allowPaste: false,
  tags: [],
};

const STORAGE_KEY = 'htxlabs:state:t/x';

function seedSavedState(opts: {
  mode: 'guided' | 'open';
  currentPhaseId: string;
  visitedPhaseIds: string[];
  widgetValues?: Record<string, unknown>;
}) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      experimentId: 't/x',
      experimentVersion: 1,
      mode: opts.mode,
      labMode: 'virtual',
      currentPhaseId: opts.currentPhaseId,
      visitedPhaseIds: opts.visitedPhaseIds,
      firedMilestones: {},
      dataPointCount: {},
      widgetValues: opts.widgetValues ?? {},
      dataTables: {},
      attemptCounts: {},
    }),
  );
}

describe('ModePicker — mode-switch semantics', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clicking the same mode as the saved one delegates without wiping', async () => {
    const user = userEvent.setup();
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'maal',
      visitedPhaseIds: ['planlaeg', 'maal'],
    });
    const onSelect = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.guided.title }));

    expect(onSelect).toHaveBeenCalledWith('guided');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('different mode + meaningful progress prompts confirm; on accept wipes and delegates', async () => {
    const user = userEvent.setup();
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'maal',
      visitedPhaseIds: ['planlaeg', 'maal'],
    });
    const onSelect = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.open.title }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('different mode + meaningful progress + confirm cancelled keeps everything', async () => {
    const user = userEvent.setup();
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'maal',
      visitedPhaseIds: ['planlaeg', 'maal'],
    });
    const onSelect = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.open.title }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('different mode + trivial state (first phase, no widget values) wipes silently', async () => {
    const user = userEvent.setup();
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
    });
    const onSelect = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.open.title }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('different mode + first phase but with widget values still prompts confirm', async () => {
    const user = userEvent.setup();
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      widgetValues: { ft1: 'some answer' },
    });
    const onSelect = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.open.title }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('open');
  });

  it('shows FORTSÆT on the saved mode card when widget values exist in phase 1', () => {
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
      widgetValues: { ft1: 'partial' },
    });

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={vi.fn()}
      />,
    );
    const guided = screen.getByRole('button', { name: strings.landing.modeCards.guided.title });
    expect(guided.textContent).toContain(strings.landing.continueLabel);
    const open = screen.getByRole('button', { name: strings.landing.modeCards.open.title });
    expect(open.textContent).toContain(strings.landing.startLabel);
  });

  it('shows START on saved mode when phase-1 has no widget values and no advance', () => {
    seedSavedState({
      mode: 'guided',
      currentPhaseId: 'planlaeg',
      visitedPhaseIds: ['planlaeg'],
    });

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={vi.fn()}
      />,
    );
    const guided = screen.getByRole('button', { name: strings.landing.modeCards.guided.title });
    expect(guided.textContent).toContain(strings.landing.startLabel);
  });

  it('no saved state at all: delegate without confirm or wipe', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm');

    render(
      <ModePicker
        experiment={experiment}
        experimentId="t/x"
        saved={load('t/x')}
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: strings.landing.modeCards.open.title }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('open');
  });
});
