// @vitest-environment node
import { isVisibleInEnv, validateAuthorableGates, validateSimGateRefs } from '@/lib/content';
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { Gate, Phase } from '@/lib/schema';
import type { SimulationMeta } from '@/sim-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makePhase(id: string, gate: Gate): Phase {
  return { id, title: id, gate };
}

function makeFrontmatter(overrides: {
  guided?: Phase[];
  semiGuided?: Phase[];
  open?: Phase[];
}): ExperimentFrontmatter {
  return {
    version: 1,
    title: 'Test',
    simulationId: '__none',
    simulationOverrides: undefined,
    learningObjectives: ['x'],
    keyConcepts: [],
    difficulty: 'b-level',
    modes: {
      guided: { phases: overrides.guided ?? [makePhase('p1', { type: 'always' })] },
      ...(overrides.semiGuided ? { 'semi-guided': { phases: overrides.semiGuided } } : {}),
      ...(overrides.open ? { open: { phases: overrides.open } } : {}),
    },
    labModes: { virtual: { enabled: true } },
    allowPaste: false,
    tags: [],
  };
}

const ctx = { topic: 'mekanik', slug: 'demo' };

// The phase-id soft warn fires for any non-canonical id. Most tests below use
// short throwaway ids (`p1`, `a`, `mid`) that aren't in CANONICAL_PHASE_IDS;
// silence warn at the file level so the noise doesn't bury real failures.
// The dedicated soft-warn describe block re-spies and asserts on the calls.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateAuthorableGates', () => {
  describe('accepts supported kinds', () => {
    const supported: Gate[] = [
      { type: 'always' },
      { type: 'all-filled', widgetIds: ['a'] },
      { type: 'all-checked', widgetIds: ['a'] },
      { type: 'all-correct', widgetIds: ['a'] },
      { type: 'keyword-count', widgetId: 'a', min: 'all' },
      { type: 'keyword-count', widgetId: 'a', min: 3 },
      { type: 'all-satisfied', widgetIds: ['a', 'b'] },
      { type: 'all-validated', widgetIds: ['a'] },
    ];
    for (const gate of supported) {
      it(`accepts ${gate.type}${'min' in gate ? ` (min=${String(gate.min)})` : ''}`, () => {
        const fm = makeFrontmatter({ guided: [makePhase('p1', gate)] });
        expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
      });
    }

    it('accepts a multi-phase guided lab using all five supported kinds', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('a', { type: 'always' }),
          makePhase('b', { type: 'all-filled', widgetIds: ['x'] }),
          makePhase('c', { type: 'all-checked', widgetIds: ['x'] }),
          makePhase('d', { type: 'all-correct', widgetIds: ['x'] }),
          makePhase('e', { type: 'keyword-count', widgetId: 'x', min: 'all' }),
        ],
      });
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
    });

    it('accepts supported kinds across guided + semi-guided + open', () => {
      const fm = makeFrontmatter({
        guided: [makePhase('g', { type: 'always' })],
        semiGuided: [makePhase('s', { type: 'all-filled', widgetIds: ['x'] })],
        open: [makePhase('o', { type: 'all-checked', widgetIds: ['x'] })],
      });
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
    });
  });

  describe('rejects unsupported kinds', () => {
    const unsupported: Gate[] = [
      { type: 'data-points', min: 5 },
      { type: 'milestone', requires: 'm1' },
      { type: 'predicate', name: 'p1' },
    ];
    for (const gate of unsupported) {
      it(`rejects ${gate.type} with a message naming topic/slug/mode/phase/kind`, () => {
        const fm = makeFrontmatter({ guided: [makePhase('analyser', gate)] });
        expect(() => validateAuthorableGates(fm, ctx)).toThrow(
          new RegExp(
            `\\[content\\] mekanik/demo mode "guided" phase "analyser" uses gate kind "${gate.type}"`,
          ),
        );
      });
    }

    it('lists the supported kinds in the error message', () => {
      // Order reflects GATE_HANDLERS insertion order in src/lab-guide/gates.ts —
      // the handler map is the source of truth for AUTHORABLE_GATE_KINDS.
      const fm = makeFrontmatter({
        guided: [makePhase('p', { type: 'predicate', name: 'foo' })],
      });
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(
        /Supported kinds: always, all-correct, all-checked, all-filled, keyword-count, rubric-required, all-satisfied, all-validated\./,
      );
    });

    it('detects unsupported kinds in semi-guided mode', () => {
      const fm = makeFrontmatter({
        guided: [makePhase('g', { type: 'always' })],
        semiGuided: [makePhase('mid', { type: 'milestone', requires: 'x' })],
      });
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(
        /mode "semi-guided" phase "mid" uses gate kind "milestone"/,
      );
    });

    it('detects unsupported kinds in open mode', () => {
      const fm = makeFrontmatter({
        guided: [makePhase('g', { type: 'always' })],
        open: [makePhase('end', { type: 'data-points', min: 3 })],
      });
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(
        /mode "open" phase "end" uses gate kind "data-points"/,
      );
    });

    it('admits sim-driven kinds when the lab wires a non-__none simulationId', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('maal', { type: 'data-points', min: 5 }),
          makePhase('konkluder', { type: 'predicate', name: 'wide-range' }),
          makePhase('rapporter', { type: 'milestone', requires: 'review-completed' }),
        ],
      });
      fm.simulationId = 'template-sim';
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
    });

    it('still rejects sim-driven kinds on theory-only labs (__none)', () => {
      const fm = makeFrontmatter({
        guided: [makePhase('maal', { type: 'data-points', min: 5 })],
      });
      // simulationId already '__none' by default — guard fires.
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(
        /uses gate kind "data-points"/,
      );
    });

    it('accepts all-satisfied on a theory-only lab (flat, widget-driven only)', () => {
      // The new combinator is flat (no nested gates), so there is no recursion
      // path through which a sim-driven kind could smuggle itself onto a
      // theory-only lab. Validates that the kind itself is in AUTHORABLE_GATE_KINDS.
      const fm = makeFrontmatter({
        guided: [
          makePhase('planlaeg', {
            type: 'all-satisfied',
            widgetIds: ['variables', 'hypotese'],
          }),
        ],
      });
      // simulationId is '__none' by default → theory-only path.
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
    });

    it('skips the check when the lab is tagged "test" (framework testbed escape hatch)', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('a', { type: 'milestone', requires: 'm1' }),
          makePhase('b', { type: 'data-points', min: 3 }),
          makePhase('c', { type: 'predicate', name: 'flag-on' }),
        ],
      });
      fm.tags = ['test'];
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow();
    });

    it('reports the first offending phase only', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('ok', { type: 'always' }),
          makePhase('first-bad', { type: 'predicate', name: 'a' }),
          makePhase('second-bad', { type: 'milestone', requires: 'b' }),
        ],
      });
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(/phase "first-bad"/);
      expect(() => validateAuthorableGates(fm, ctx)).not.toThrow(/phase "second-bad"/);
    });
  });

  describe('canonical phase id soft warn', () => {
    // The file-level beforeEach already stubs console.warn — these tests
    // assert against that same mock (vi.mocked(console.warn)).

    it('does not warn for canonical ids', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('planlaeg', { type: 'always' }),
          makePhase('opstil', { type: 'always' }),
          makePhase('rapporter', { type: 'always' }),
        ],
      });
      validateAuthorableGates(fm, ctx);
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('warns once per non-canonical id, naming SPEC §2', () => {
      const fm = makeFrontmatter({
        guided: [
          makePhase('planlaeg', { type: 'always' }),
          makePhase('udforsk', { type: 'always' }),
        ],
      });
      validateAuthorableGates(fm, ctx);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toMatch(
        /non-canonical phase id "udforsk"/,
      );
      expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toMatch(/SPEC §2/);
    });

    it('does not warn for test-tagged labs (testbed escape hatch)', () => {
      const fm = makeFrontmatter({
        guided: [makePhase('udforsk', { type: 'always' })],
      });
      fm.tags = ['test'];
      validateAuthorableGates(fm, ctx);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

describe('validateSimGateRefs', () => {
  function makeMeta(milestones: string[]): SimulationMeta {
    return {
      id: 'testsim',
      title: 'Test sim',
      mode: 'interactive',
      defaultParams: {},
      paramSchema: {},
      milestones,
    };
  }

  it('is a no-op when no sim is resolved (theory-only labs)', () => {
    const fm = makeFrontmatter({
      guided: [makePhase('planlaeg', { type: 'milestone', requires: 'm1' })],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, undefined, ctx)).not.toThrow();
  });

  it('passes when every milestone gate references a declared id', () => {
    const fm = makeFrontmatter({
      guided: [
        makePhase('planlaeg', { type: 'milestone', requires: 'm1' }),
        makePhase('maal', { type: 'milestone', requires: 'm2' }),
      ],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, makeMeta(['m1', 'm2']), ctx)).not.toThrow();
  });

  it('throws naming the typo, the sim, and the known milestones', () => {
    const fm = makeFrontmatter({
      guided: [makePhase('planlaeg', { type: 'milestone', requires: 'm11' })],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, makeMeta(['m1', 'm2']), ctx)).toThrow(
      /requires milestone "m11", which sim "testsim" does not declare. Known milestones: m1, m2/,
    );
  });

  it('reports `(none declared)` when the sim has an empty milestones list', () => {
    const fm = makeFrontmatter({
      guided: [makePhase('planlaeg', { type: 'milestone', requires: 'm1' })],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, makeMeta([]), ctx)).toThrow(/\(none declared\)/);
  });

  it('ignores non-milestone gates', () => {
    const fm = makeFrontmatter({
      guided: [
        makePhase('planlaeg', { type: 'always' }),
        makePhase('maal', { type: 'data-points', min: 3 }),
        makePhase('analyser', { type: 'predicate', name: 'flag-on' }),
      ],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, makeMeta([]), ctx)).not.toThrow();
  });

  it('checks milestone gates across all declared modes', () => {
    const fm = makeFrontmatter({
      guided: [makePhase('planlaeg', { type: 'always' })],
      semiGuided: [makePhase('maal', { type: 'milestone', requires: 'bogus' })],
    });
    fm.tags = ['test'];
    expect(() => validateSimGateRefs(fm, makeMeta(['m1']), ctx)).toThrow(
      /mode "semi-guided".*"bogus"/,
    );
  });
});

describe('isVisibleInEnv', () => {
  function fm(devOnly: boolean | undefined): ExperimentFrontmatter {
    const f = makeFrontmatter({});
    f.devOnly = devOnly;
    return f;
  }

  it('hides a devOnly lab in production', () => {
    expect(isVisibleInEnv(fm(true), true)).toBe(false);
  });

  it('shows a devOnly lab in dev', () => {
    expect(isVisibleInEnv(fm(true), false)).toBe(true);
  });

  it('shows a lab with devOnly:false in production', () => {
    expect(isVisibleInEnv(fm(false), true)).toBe(true);
  });

  it('shows a lab with devOnly omitted in production', () => {
    expect(isVisibleInEnv(fm(undefined), true)).toBe(true);
  });

  it('shows everything in dev', () => {
    expect(isVisibleInEnv(fm(false), false)).toBe(true);
    expect(isVisibleInEnv(fm(undefined), false)).toBe(true);
  });
});
