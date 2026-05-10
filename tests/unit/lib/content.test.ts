// @vitest-environment node
import { validateAuthorableGates } from '@/lib/content';
import type { ExperimentFrontmatter } from '@/lib/schema';
import type { Gate, Phase } from '@/lib/schema';
import { describe, expect, it } from 'vitest';

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
    topic: 'mekanik',
    simulationId: '__none',
    simulationOverrides: undefined,
    learningObjectives: ['x'],
    keyConcepts: [],
    difficulty: 'core',
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

describe('validateAuthorableGates', () => {
  describe('accepts supported kinds', () => {
    const supported: Gate[] = [
      { type: 'always' },
      { type: 'all-filled', widgetIds: ['a'] },
      { type: 'all-checked', widgetIds: ['a'] },
      { type: 'all-correct', widgetIds: ['a'] },
      { type: 'keyword-count', widgetId: 'a', min: 'all' },
      { type: 'keyword-count', widgetId: 'a', min: 3 },
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
      const fm = makeFrontmatter({
        guided: [makePhase('p', { type: 'predicate', name: 'foo' })],
      });
      expect(() => validateAuthorableGates(fm, ctx)).toThrow(
        /Supported kinds: always, all-filled, all-checked, all-correct, keyword-count\./,
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
});
