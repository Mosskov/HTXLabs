// Rubric evaluation engine: parseRubric (load-time validation) + evaluateRubric (never throws).
import type { z } from 'zod';
import type { Embedder } from './embedder';
import {
  type Check,
  type Criterion,
  type Misconception,
  type Rubric,
  RubricSchema,
  type Veto,
} from './schema';

export type CheckStatus =
  | 'pass'
  | 'fail'
  | 'skipped-embedder'
  | 'skipped-too-short'
  | 'skipped-bad-regex';

export type VetoStatus = 'triggered' | 'not-triggered' | 'skipped-bad-regex';
export type MisconceptionStatus = 'triggered' | 'not-triggered' | 'skipped-bad-regex';

export interface CheckResult {
  kind: Check['kind'];
  status: CheckStatus;
  /** semantic: max cosine across anchors */
  score?: number;
  /** semantic: which anchor produced the max — evidence trail */
  bestAnchor?: { text: string; score: number };
  /** semantic, debug mode only */
  anchorScores?: { text: string; score: number }[];
  /** regex/literal hits */
  matches?: string[];
  hint?: string;
}

export interface CriterionResult {
  id: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  /** false iff every check ended in 'skipped-*' */
  evaluable: boolean;
  /** true iff some checks were skipped AND some were evaluated → verdict is partial */
  degraded: boolean;
  vetoed: boolean;
  checks: CheckResult[];
  vetoes: { kind: Veto['kind']; status: VetoStatus }[];
  misconceptions: { pattern: string; hint: string; status: MisconceptionStatus }[];
  hint?: string;
}

export interface RubricResult {
  rubricId: string;
  rubricVersion: number;
  criteria: CriterionResult[];
  /** all required:true criteria satisfied → the gate signal */
  requiredSatisfied: boolean;
  /** every criterion satisfied → "you nailed everything" */
  allSatisfied: boolean;
}

/** Load-time validation. Bad rubric is filtered out at the type boundary, so
 *  `evaluateRubric` only sees valid rubrics and can be total. */
export function parseRubric(
  input: unknown,
): { ok: true; rubric: Rubric } | { ok: false; errors: z.ZodIssue[] } {
  const result = RubricSchema.safeParse(input);
  if (result.success) return { ok: true, rubric: result.data };
  return { ok: false, errors: result.error.issues };
}

export async function evaluateRubric(
  text: string,
  rubric: Rubric,
  embedder: Embedder,
  opts?: { debug?: boolean },
): Promise<RubricResult> {
  const debug = opts?.debug === true;

  const normalized = text.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();
  const wordCount = normalized === '' ? 0 : normalized.split(' ').length;

  // Collect unique anchor texts in order of first appearance, dedup across criteria.
  const anchorTexts: string[] = [];
  const anchorOrder = new Map<string, number>();
  for (const c of rubric.criteria) {
    for (const check of c.any) {
      if (check.kind === 'semantic') {
        for (const a of check.anchors) {
          if (!anchorOrder.has(a)) {
            anchorOrder.set(a, anchorTexts.length);
            anchorTexts.push(a);
          }
        }
      }
    }
  }

  // Single embed call (invariant 2: batched). Skipped if no semantic anchors exist
  // anywhere — keeps the no-semantic-checks rubric cheap.
  let studentVec: number[] | null = null;
  const anchorVecs = new Map<string, number[]>();
  if (anchorTexts.length > 0) {
    try {
      const vectors = await embedder.embed([normalized, ...anchorTexts]);
      studentVec = vectors[0] ?? null;
      for (let i = 0; i < anchorTexts.length; i++) {
        const v = vectors[i + 1];
        const t = anchorTexts[i];
        if (v && t !== undefined) anchorVecs.set(t, v);
      }
    } catch {
      studentVec = null;
    }
  }

  const criteria = rubric.criteria.map((c) =>
    evaluateCriterion(c, normalized, lower, wordCount, studentVec, anchorVecs, debug),
  );

  const requiredSatisfied = criteria.filter((c) => c.required).every((c) => c.satisfied);
  const allSatisfied = criteria.every((c) => c.satisfied);

  return {
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    criteria,
    requiredSatisfied,
    allSatisfied,
  };
}

function evaluateCriterion(
  criterion: Criterion,
  normalized: string,
  lower: string,
  wordCount: number,
  studentVec: number[] | null,
  anchorVecs: Map<string, number[]>,
  debug: boolean,
): CriterionResult {
  const checks = criterion.any.map((check) =>
    evaluateCheck(check, normalized, lower, wordCount, studentVec, anchorVecs, debug),
  );

  const vetoes = (criterion.none ?? []).map((v) => ({
    kind: v.kind,
    status: evaluateVeto(v, normalized, lower),
  }));

  const misconceptions = (criterion.misconceptions ?? []).map((m) => ({
    pattern: m.pattern,
    hint: m.hint,
    status: evaluateMisconception(m, normalized),
  }));

  const vetoed = vetoes.some((v) => v.status === 'triggered');
  const anyPass = checks.some((c) => c.status === 'pass');
  const anySkipped = checks.some((c) => isSkipped(c.status));
  const anyEvaluated = checks.some((c) => !isSkipped(c.status));
  const satisfied = anyPass && !vetoed;
  const evaluable = anyEvaluated;
  const degraded = anySkipped && anyEvaluated;

  // Hint tiebreak: criterion-level default, overridden by the first failed
  // check's own hint if present (author order).
  let hint = criterion.hint;
  for (const c of checks) {
    if (c.status === 'fail' && c.hint) {
      hint = c.hint;
      break;
    }
  }

  return {
    id: criterion.id,
    label: criterion.label,
    required: criterion.required,
    satisfied,
    evaluable,
    degraded,
    vetoed,
    checks,
    vetoes,
    misconceptions,
    hint,
  };
}

function evaluateCheck(
  check: Check,
  normalized: string,
  lower: string,
  wordCount: number,
  studentVec: number[] | null,
  anchorVecs: Map<string, number[]>,
  debug: boolean,
): CheckResult {
  if (check.kind === 'literal') {
    const matches = check.terms.filter((t) => lower.includes(t.toLowerCase()));
    return {
      kind: 'literal',
      status: matches.length > 0 ? 'pass' : 'fail',
      matches: matches.length > 0 ? matches : undefined,
      hint: check.hint,
    };
  }

  if (check.kind === 'regex') {
    let re: RegExp;
    try {
      re = new RegExp(check.pattern, check.flags);
    } catch {
      return { kind: 'regex', status: 'skipped-bad-regex', hint: check.hint };
    }
    const m = re.exec(normalized);
    return {
      kind: 'regex',
      status: m ? 'pass' : 'fail',
      matches: m ? [m[0]] : undefined,
      hint: check.hint,
    };
  }

  // semantic
  if (studentVec === null) {
    return { kind: 'semantic', status: 'skipped-embedder', hint: check.hint };
  }
  if (wordCount < (check.minWords ?? 3)) {
    return { kind: 'semantic', status: 'skipped-too-short', hint: check.hint };
  }

  const scores = check.anchors.map((a) => {
    const v = anchorVecs.get(a);
    const score = v ? cosine(studentVec, v) : 0;
    return { text: a, score };
  });
  // Schema guarantees anchors.length >= 1, so scores has at least one element.
  let best = scores[0] ?? { text: '', score: 0 };
  for (const s of scores) if (s.score > best.score) best = s;

  return {
    kind: 'semantic',
    status: best.score >= check.threshold ? 'pass' : 'fail',
    score: best.score,
    bestAnchor: best,
    anchorScores: debug ? scores : undefined,
    hint: check.hint,
  };
}

function evaluateVeto(veto: Veto, normalized: string, lower: string): VetoStatus {
  if (veto.kind === 'literal') {
    return veto.terms.some((t) => lower.includes(t.toLowerCase())) ? 'triggered' : 'not-triggered';
  }
  try {
    const re = new RegExp(veto.pattern, veto.flags);
    return re.test(normalized) ? 'triggered' : 'not-triggered';
  } catch {
    return 'skipped-bad-regex';
  }
}

function evaluateMisconception(m: Misconception, normalized: string): MisconceptionStatus {
  try {
    const re = new RegExp(m.pattern, m.flags);
    return re.test(normalized) ? 'triggered' : 'not-triggered';
  } catch {
    return 'skipped-bad-regex';
  }
}

function isSkipped(s: CheckStatus): boolean {
  return s === 'skipped-embedder' || s === 'skipped-too-short' || s === 'skipped-bad-regex';
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}
