// @vitest-environment node
import { MockEmbedder } from '@/lib/rubric/embedder';
import { evaluateRubric, parseRubric } from '@/lib/rubric/engine';
import type { Rubric } from '@/lib/rubric/schema';
import { beforeEach, describe, expect, it } from 'vitest';

// A 4-dimensional concept space:
//   dim 0 = IV signal, dim 1 = DV signal, dim 2 = relation signal, dim 3 = noise.
// Anchors are unit basis vectors; students are hand-designed combinations with
// known cosines. Threshold 0.5 — gold student (normalized [1,1,1,0]) has
// cos = 1/√3 ≈ 0.577 against each basis vector → passes all three.
const r2 = 1 / Math.sqrt(2);
const r3 = 1 / Math.sqrt(3);

const TEST_VECTORS: Record<string, number[]> = {
  // Anchors
  'iv anchor': [1, 0, 0, 0],
  'dv anchor': [0, 1, 0, 0],
  'rel anchor': [0, 0, 1, 0],

  // Gold student — hits all three concepts
  'iv-keyword dv-keyword rel-keyword er sand': [r3, r3, r3, 0],
  // Missing IV — only dv + rel signal
  'mangler den uafhængige, men dv-keyword og rel-keyword': [0, r2, r2, 0],
  // Missing DV
  'iv-keyword og rel-keyword, ingen afhængig': [r2, 0, r2, 0],
  // Misconception trigger — keyword soup with no semantic alignment
  'et tungere lod svinger hurtigere end et let lod': [0, 0, 0, 1],
  // Keyword soup (literal-only hits, no semantic alignment)
  'iv-keyword dv-keyword stiger ord ord': [0, 0, 0, 1],
};

function buildTestRubric(): Rubric {
  const raw = {
    id: 'test',
    version: 1,
    title: 'Test',
    criteria: [
      {
        id: 'iv',
        label: 'IV',
        any: [
          { kind: 'semantic', anchors: ['iv anchor'], threshold: 0.5 },
          { kind: 'literal', terms: ['iv-keyword'] },
        ],
        misconceptions: [
          {
            kind: 'regex',
            pattern: 'tungere.+hurtigere',
            flags: 'i',
            hint: 'Massen påvirker ikke.',
          },
        ],
      },
      {
        id: 'dv',
        label: 'DV',
        any: [
          { kind: 'semantic', anchors: ['dv anchor'], threshold: 0.5 },
          { kind: 'literal', terms: ['dv-keyword'] },
        ],
      },
      {
        id: 'relation',
        label: 'Relation',
        any: [{ kind: 'semantic', anchors: ['rel anchor'], threshold: 0.5 }],
      },
      {
        id: 'principle',
        label: 'Principle',
        required: false,
        any: [{ kind: 'literal', terms: ['principle-keyword'] }],
      },
    ],
  };
  const parsed = parseRubric(raw);
  if (!parsed.ok) throw new Error(`test rubric invalid: ${JSON.stringify(parsed.errors)}`);
  return parsed.rubric;
}

let embedder: MockEmbedder;
let rubric: Rubric;

beforeEach(() => {
  embedder = new MockEmbedder(TEST_VECTORS);
  rubric = buildTestRubric();
});

function findCriterion(result: { criteria: { id: string }[] }, id: string) {
  const c = result.criteria.find((x) => x.id === id);
  if (!c) throw new Error(`criterion ${id} missing from result`);
  return c;
}

describe('evaluateRubric — fixtures', () => {
  it('Gold: all required criteria satisfied, principle (optional) not', async () => {
    const r = await evaluateRubric('iv-keyword dv-keyword rel-keyword er sand', rubric, embedder);
    expect(findCriterion(r, 'iv').satisfied).toBe(true);
    expect(findCriterion(r, 'dv').satisfied).toBe(true);
    expect(findCriterion(r, 'relation').satisfied).toBe(true);
    expect(findCriterion(r, 'principle').satisfied).toBe(false);
    expect(r.requiredSatisfied).toBe(true);
    expect(r.allSatisfied).toBe(false); // principle missing
    for (const c of r.criteria) {
      expect(c.evaluable).toBe(true);
      expect(c.degraded).toBe(false);
    }
  });

  it('Missing IV: iv fails, dv + relation pass', async () => {
    const r = await evaluateRubric(
      'mangler den uafhængige, men dv-keyword og rel-keyword',
      rubric,
      embedder,
    );
    expect(findCriterion(r, 'iv').satisfied).toBe(false);
    expect(findCriterion(r, 'dv').satisfied).toBe(true);
    expect(findCriterion(r, 'relation').satisfied).toBe(true);
    expect(r.requiredSatisfied).toBe(false);
  });

  it('Missing DV: dv fails, iv + relation pass', async () => {
    const r = await evaluateRubric('iv-keyword og rel-keyword, ingen afhængig', rubric, embedder);
    expect(findCriterion(r, 'iv').satisfied).toBe(true);
    expect(findCriterion(r, 'dv').satisfied).toBe(false);
    expect(findCriterion(r, 'relation').satisfied).toBe(true);
  });

  it('Misconception: triggered status surfaces on iv criterion', async () => {
    const r = await evaluateRubric(
      'et tungere lod svinger hurtigere end et let lod',
      rubric,
      embedder,
    );
    const iv = findCriterion(r, 'iv');
    expect(iv.misconceptions).toHaveLength(1);
    expect(iv.misconceptions[0].status).toBe('triggered');
    // The misconception text doesn't include iv-keyword, so the iv criterion still fails.
    expect(iv.satisfied).toBe(false);
  });

  it('Keyword soup: literal fallback passes iv+dv, relation fails (semantic-only)', async () => {
    const r = await evaluateRubric('iv-keyword dv-keyword stiger ord ord', rubric, embedder);
    expect(findCriterion(r, 'iv').satisfied).toBe(true); // literal hit
    expect(findCriterion(r, 'dv').satisfied).toBe(true); // literal hit
    expect(findCriterion(r, 'relation').satisfied).toBe(false); // no semantic alignment, no literal fallback
  });

  it('Empty "ja": semantic skipped-too-short; literal still fails naturally', async () => {
    const r = await evaluateRubric('ja', rubric, embedder);

    const iv = findCriterion(r, 'iv');
    expect(iv.satisfied).toBe(false);
    expect(iv.evaluable).toBe(true); // literal check ran
    expect(iv.degraded).toBe(true); // semantic was skipped, literal evaluated
    expect(iv.checks.find((c) => c.kind === 'semantic')?.status).toBe('skipped-too-short');
    expect(iv.checks.find((c) => c.kind === 'literal')?.status).toBe('fail');

    const relation = findCriterion(r, 'relation'); // semantic-only
    expect(relation.satisfied).toBe(false);
    expect(relation.evaluable).toBe(false);
    expect(relation.degraded).toBe(false);

    const principle = findCriterion(r, 'principle'); // literal-only
    expect(principle.satisfied).toBe(false);
    expect(principle.evaluable).toBe(true);
    expect(principle.degraded).toBe(false);
  });
});

describe('evaluateRubric — invariants', () => {
  it('batched embedding: embedder.embed called exactly once per evaluation', async () => {
    await evaluateRubric('iv-keyword dv-keyword rel-keyword er sand', rubric, embedder);
    expect(embedder.calls).toBe(1);
  });

  it('max-pooling: score is the max cosine across anchors, bestAnchor records the winner', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          any: [{ kind: 'semantic', anchors: ['low', 'high'], threshold: 0.5, minWords: 1 }],
        },
      ],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const emb = new MockEmbedder({
      student: [1, 0, 0, 0],
      low: [0.4, Math.sqrt(1 - 0.16), 0, 0], // cos with student = 0.4
      high: [0.8, Math.sqrt(1 - 0.64), 0, 0], // cos with student = 0.8
    });
    const r = await evaluateRubric('student', parsed.rubric, emb);
    const semantic = r.criteria[0].checks[0];
    expect(semantic.score).toBeCloseTo(0.8, 5);
    expect(semantic.bestAnchor?.text).toBe('high');
    expect(semantic.status).toBe('pass');
  });

  it('embedder rejection: semantic-only criteria become non-evaluable; mixed become degraded', async () => {
    const broken: typeof embedder = {
      embed: async () => {
        throw new Error('boom');
      },
    } as unknown as MockEmbedder;
    const r = await evaluateRubric('iv-keyword dv-keyword rel-keyword er sand', rubric, broken);

    const relation = findCriterion(r, 'relation'); // semantic-only
    expect(relation.checks[0].status).toBe('skipped-embedder');
    expect(relation.evaluable).toBe(false);
    expect(relation.degraded).toBe(false);

    const iv = findCriterion(r, 'iv'); // semantic + literal
    expect(iv.checks.find((c) => c.kind === 'semantic')?.status).toBe('skipped-embedder');
    expect(iv.evaluable).toBe(true); // literal ran
    expect(iv.degraded).toBe(true);
  });

  it('bad regex in a check: status skipped-bad-regex, no throw', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          any: [{ kind: 'regex', pattern: '(' }], // unclosed paren
        },
      ],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('hello', parsed.rubric, embedder);
    expect(r.criteria[0].checks[0].status).toBe('skipped-bad-regex');
  });

  it('bad regex in a veto: status skipped-bad-regex, veto does not trigger (fail-safe for student)', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          any: [{ kind: 'literal', terms: ['hello'] }],
          none: [{ kind: 'regex', pattern: '(' }],
        },
      ],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('hello world', parsed.rubric, embedder);
    expect(r.criteria[0].vetoes[0].status).toBe('skipped-bad-regex');
    expect(r.criteria[0].vetoed).toBe(false); // not 'triggered' → no fail-shut
    expect(r.criteria[0].satisfied).toBe(true);
  });

  it('bad regex in a misconception: status skipped-bad-regex, no throw', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          any: [{ kind: 'literal', terms: ['hello'] }],
          misconceptions: [{ kind: 'regex', pattern: '(', hint: 'oops' }],
        },
      ],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('hello', parsed.rubric, embedder);
    expect(r.criteria[0].misconceptions[0].status).toBe('skipped-bad-regex');
  });

  it('hint tiebreak: criterion default unless a failed check overrides', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          hint: 'criterion default',
          any: [{ kind: 'literal', terms: ['hello'], hint: 'check-specific' }],
        },
      ],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('no match here', parsed.rubric, embedder);
    expect(r.criteria[0].hints).toEqual(['check-specific']);
  });

  it('debug payload: anchorScores populated only when opts.debug=true', async () => {
    const off = await evaluateRubric('iv-keyword dv-keyword rel-keyword er sand', rubric, embedder);
    const offSemantic = off.criteria
      .find((c) => c.id === 'iv')
      ?.checks.find((c) => c.kind === 'semantic');
    expect(offSemantic?.anchorScores).toBeUndefined();

    const on = await evaluateRubric('iv-keyword dv-keyword rel-keyword er sand', rubric, embedder, {
      debug: true,
    });
    const onSemantic = on.criteria
      .find((c) => c.id === 'iv')
      ?.checks.find((c) => c.kind === 'semantic');
    expect(onSemantic?.anchorScores).toBeDefined();
    expect(onSemantic?.anchorScores?.length).toBeGreaterThan(0);
  });

  it('case-insensitive literal matching: capitalized student text matches lowercase term', async () => {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [{ id: 'c', label: 'c', any: [{ kind: 'literal', terms: ['snorlængde'] }] }],
    };
    const parsed = parseRubric(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('Snorlængde er konstant', parsed.rubric, embedder);
    expect(r.criteria[0].satisfied).toBe(true);
  });
});

describe('literal matching is whole-word (Unicode-aware)', () => {
  function singleLiteral(terms: string[], vetoTerms?: string[]) {
    const raw = {
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c1',
          label: 'c1',
          any: [{ kind: 'literal', terms }],
          ...(vetoTerms ? { none: [{ kind: 'literal', terms: vetoTerms }] } : {}),
        },
      ],
    };
    const parsed = parseRubric(raw);
    if (!parsed.ok) throw new Error(`rubric invalid: ${JSON.stringify(parsed.errors)}`);
    return parsed.rubric;
  }

  it('does NOT match a term embedded inside a longer Danish word', async () => {
    const r = await evaluateRubric(
      'X er den uafhængige variabel',
      singleLiteral(['afhængig']),
      embedder,
    );
    expect(r.criteria[0].satisfied).toBe(false);
  });

  it('matches when the term is a standalone word', async () => {
    const r = await evaluateRubric('Y er afhængig variabel', singleLiteral(['afhængig']), embedder);
    expect(r.criteria[0].satisfied).toBe(true);
  });

  it('does NOT match inflected forms — literal is the exact stem', async () => {
    // "afhængige" trails the term with letter `e` — lookahead rejects it.
    // Authors who need inflection should list variants or use regex.
    const r = await evaluateRubric(
      'Y er den afhængige variabel',
      singleLiteral(['afhængig']),
      embedder,
    );
    expect(r.criteria[0].satisfied).toBe(false);
  });

  it('matches at punctuation boundaries', async () => {
    const r1 = await evaluateRubric('Y er afhængig, ja.', singleLiteral(['afhængig']), embedder);
    const r2 = await evaluateRubric('(afhængig)', singleLiteral(['afhængig']), embedder);
    expect(r1.criteria[0].satisfied).toBe(true);
    expect(r2.criteria[0].satisfied).toBe(true);
  });

  it('treats hyphen as a non-letter boundary', async () => {
    const r = await evaluateRubric('X-afhængig størrelse', singleLiteral(['afhængig']), embedder);
    expect(r.criteria[0].satisfied).toBe(true);
  });

  it('applies the same rule to literal vetoes', async () => {
    // "konstantinopel" must NOT trigger a veto on "konstant".
    const r = await evaluateRubric(
      'Y i konstantinopel',
      singleLiteral(['Y'], ['konstant']),
      embedder,
    );
    expect(r.criteria[0].vetoed).toBe(false);
    expect(r.criteria[0].satisfied).toBe(true);
  });
});

describe('regex diagnostics carry the failing pattern', () => {
  it('check: populates `pattern` on skipped-bad-regex', async () => {
    const parsed = parseRubric({
      id: 't',
      version: 1,
      title: 'T',
      criteria: [{ id: 'c', label: 'c', any: [{ kind: 'regex', pattern: '(unclosed' }] }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('whatever', parsed.rubric, embedder);
    expect(r.criteria[0].checks[0].status).toBe('skipped-bad-regex');
    expect(r.criteria[0].checks[0].pattern).toBe('(unclosed');
  });

  it('check: populates `pattern` on a passing regex too', async () => {
    const parsed = parseRubric({
      id: 't',
      version: 1,
      title: 'T',
      criteria: [{ id: 'c', label: 'c', any: [{ kind: 'regex', pattern: 'foo' }] }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('foo bar', parsed.rubric, embedder);
    expect(r.criteria[0].checks[0].status).toBe('pass');
    expect(r.criteria[0].checks[0].pattern).toBe('foo');
  });

  it('veto: populates `pattern` on skipped-bad-regex', async () => {
    const parsed = parseRubric({
      id: 't',
      version: 1,
      title: 'T',
      criteria: [
        {
          id: 'c',
          label: 'c',
          any: [{ kind: 'literal', terms: ['x'] }],
          none: [{ kind: 'regex', pattern: '(also-unclosed' }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('x', parsed.rubric, embedder);
    expect(r.criteria[0].vetoes[0].status).toBe('skipped-bad-regex');
    expect(r.criteria[0].vetoes[0].pattern).toBe('(also-unclosed');
  });
});

describe('evaluateRubric — hints normalization', () => {
  const buildEmbedder = () => new MockEmbedder({});

  it('surfaces hints[] verbatim when criterion uses tiered hints', async () => {
    const parsed = parseRubric({
      id: 'rh',
      version: 1,
      title: 'rh',
      criteria: [
        {
          id: 'c1',
          label: 'c1',
          hints: ['t1', 't2', 't3'],
          any: [{ kind: 'literal', terms: ['nope'] }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('nothing matching', parsed.rubric, buildEmbedder());
    expect(r.criteria[0].hints).toEqual(['t1', 't2', 't3']);
  });

  it('wraps legacy hint string in a single-element list', async () => {
    const parsed = parseRubric({
      id: 'rh',
      version: 1,
      title: 'rh',
      criteria: [
        {
          id: 'c1',
          label: 'c1',
          hint: 'one shot',
          any: [{ kind: 'literal', terms: ['nope'] }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('nothing matching', parsed.rubric, buildEmbedder());
    expect(r.criteria[0].hints).toEqual(['one shot']);
  });

  it('falls back to a failed check-level hint when no criterion hint is set', async () => {
    const parsed = parseRubric({
      id: 'rh',
      version: 1,
      title: 'rh',
      criteria: [
        {
          id: 'c1',
          label: 'c1',
          any: [{ kind: 'literal', terms: ['nope'], hint: 'check-level' }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('nothing matching', parsed.rubric, buildEmbedder());
    expect(r.criteria[0].hints).toEqual(['check-level']);
  });

  it('returns an empty list when no hint is authored anywhere', async () => {
    const parsed = parseRubric({
      id: 'rh',
      version: 1,
      title: 'rh',
      criteria: [
        {
          id: 'c1',
          label: 'c1',
          any: [{ kind: 'literal', terms: ['nope'] }],
        },
      ],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await evaluateRubric('nothing matching', parsed.rubric, buildEmbedder());
    expect(r.criteria[0].hints).toEqual([]);
  });
});
