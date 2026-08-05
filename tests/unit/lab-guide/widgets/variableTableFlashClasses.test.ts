// @vitest-environment node
// Pure-helper unit tests for flashClasses. The class names here are
// load-bearing: `animate-vt-flash-fade` and `animate-vt-flash-fade-to-white`
// are keyframe utilities defined in globals.css, and a typo is invisible to
// both the type checker and the component tests.
import { flashClasses } from '@/lab-guide/widgets/VariableTableField';
import { describe, expect, it } from 'vitest';

describe('flashClasses', () => {
  it('is transparent with no animation between Tjeks', () => {
    expect(flashClasses(null, true, false)).toEqual({
      flashClass: 'rounded bg-transparent',
      inputFlashClass: '',
    });
  });

  it('fades emerald to transparent on a newly locked cell', () => {
    const { flashClass } = flashClasses('correct', true, true);
    expect(flashClass).toContain('bg-emerald-100');
    expect(flashClass).toContain('animate-vt-flash-fade');
    expect(flashClass).not.toContain('animate-vt-flash-fade-to-white');
  });

  it('fades rose to white on a wrong cell', () => {
    // The editable input regains bg-white when the flash clears, so the
    // wrapper must fade to white rather than transparent.
    const { flashClass } = flashClasses('wrong', true, false);
    expect(flashClass).toContain('bg-rose-100');
    expect(flashClass).toContain('animate-vt-flash-fade-to-white');
  });

  it('omits the keyframe under reduced motion but keeps the colour', () => {
    const { flashClass } = flashClasses('correct', false, true);
    expect(flashClass).toContain('bg-emerald-100');
    expect(flashClass).not.toContain('animate-');
  });

  it('forces an unlocked input transparent during a rose flash', () => {
    // ProtectedInput hardcodes bg-white, which would cover the wrapper's flash.
    expect(flashClasses('wrong', true, false).inputFlashClass).toBe(' !bg-transparent');
  });

  it('leaves a locked input alone during a flash', () => {
    // The locked branch's input is already bg-transparent.
    expect(flashClasses('wrong', true, true).inputFlashClass).toBe('');
    expect(flashClasses('correct', true, false).inputFlashClass).toBe('');
  });
});
