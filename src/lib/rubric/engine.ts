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

export const CHECK_STATUSES = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIPPED_EMBEDDER: 'skipped-embedder',
  SKIPPED_TOO_SHORT: 'skipped-too-short',
  SKIPPED_BAD_REGEX: 'skipped-bad-regex',
} as const;

export const VETO_STATUSES = {
  TRIGGERED: 'triggered',
  NOT_TRIGGERED: 'not-triggered',
  SKIPPED_BAD_REGEX: 'skipped-bad-regex',
} as const;

export type CheckStatus = (typeof CHECK_STATUSES)[keyof typeof CHECK_STATUSES];
export type VetoStatus = (typeof VETO_STATUSES)[keyof typeof VETO_STATUSES];
export type MisconceptionStatus = VetoStatus;

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
  /** regex: the authored pattern. Surfaced so dev diagnostics can name a
   *  failing-to-compile regex instead of reporting just "regex". */
  pattern?: string;
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
  /** `pattern` populated only for regex vetoes — same diagnostic rationale as `CheckResult.pattern`. */
  vetoes: { kind: Veto['kind']; status: VetoStatus; pattern?: string }[];
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

/** Compiled-regex cache keyed by the schema node's object identity. A bad
 *  regex is cached as `null` so the skipped-bad-regex path stays free of
 *  retries. WeakMap means parsed rubrics that go out of scope GC normally. */
const regexCache = new WeakMap<object, RegExp | null>();

function compileRegex(node: { pattern: string; flags?: string }): RegExp | null {
  const cached = regexCache.get(node);
  if (cached !== undefined) return cached;
  let re: RegExp | null;
  try {
    re = new RegExp(node.pattern, node.flags);
  } catch {
    re = null;
  }
  regexCache.set(node, re);
  return re;
}

/** Load-time validation. Bad rubric is filtered out at the type boundary, so
 *  `evaluateRubric` only sees valid rubrics and can be total. Also pre-compiles
 *  every regex node so per-evaluation cost is one cache lookup per check. */
export function parseRubric(
  input: unknown,
): { ok: true; rubric: Rubric } | { ok: false; errors: z.ZodIssue[] } {
  const result = RubricSchema.safeParse(input);
  if (!result.success) return { ok: false, errors: result.error.issues };
  const rubric = result.data;
  for (const c of rubric.criteria) {
    for (const check of c.any) if (check.kind === 'regex') compileRegex(check);
    for (const v of c.none ?? []) if (v.kind === 'regex') compileRegex(v);
    for (const m of c.misconceptions ?? []) compileRegex(m);
  }
  return { ok: true, rubric };
}

export async function evaluateRubric(
  text: string,
  rubric: Rubric,
  embedder: Embedder,
  opts?: { debug?: boolean },
): Promise<RubricResult> {
  const debug = opts?.debug === true;

  const normalized = text.trim().replace(/\s+/g, ' ');
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
    evaluateCriterion(c, normalized, wordCount, studentVec, anchorVecs, debug),
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
  wordCount: number,
  studentVec: number[] | null,
  anchorVecs: Map<string, number[]>,
  debug: boolean,
): CriterionResult {
  const checks = criterion.any.map((check) =>
    evaluateCheck(check, normalized, wordCount, studentVec, anchorVecs, debug),
  );

  const vetoes = (criterion.none ?? []).map((v) => ({
    kind: v.kind,
    status: evaluateVeto(v, normalized),
    pattern: v.kind === 'regex' ? v.pattern : undefined,
  }));

  const misconceptions = (criterion.misconceptions ?? []).map((m) => ({
    pattern: m.pattern,
    hint: m.hint,
    status: evaluateMisconception(m, normalized),
  }));

  const vetoed = vetoes.some((v) => v.status === VETO_STATUSES.TRIGGERED);
  const anyPass = checks.some((c) => c.status === CHECK_STATUSES.PASS);
  const anySkipped = checks.some((c) => isSkipped(c.status));
  const anyEvaluated = checks.some((c) => !isSkipped(c.status));
  const satisfied = anyPass && !vetoed;
  const evaluable = anyEvaluated;
  const degraded = anySkipped && anyEvaluated;

  // Hint tiebreak: criterion-level default, overridden by the first failed
  // check's own hint if present (author order).
  let hint = criterion.hint;
  for (const c of checks) {
    if (c.status === CHECK_STATUSES.FAIL && c.hint) {
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
  wordCount: number,
  studentVec: number[] | null,
  anchorVecs: Map<string, number[]>,
  debug: boolean,
): CheckResult {
  if (check.kind === 'literal') {
    const matches = check.terms.filter((t) => matchesWord(normalized, t));
    return {
      kind: 'literal',
      status: matches.length > 0 ? CHECK_STATUSES.PASS : CHECK_STATUSES.FAIL,
      matches: matches.length > 0 ? matches : undefined,
      hint: check.hint,
    };
  }

  if (check.kind === 'regex') {
    const re = compileRegex(check);
    if (re === null) {
      return {
        kind: 'regex',
        status: CHECK_STATUSES.SKIPPED_BAD_REGEX,
        pattern: check.pattern,
        hint: check.hint,
      };
    }
    const m = re.exec(normalized);
    return {
      kind: 'regex',
      status: m ? CHECK_STATUSES.PASS : CHECK_STATUSES.FAIL,
      matches: m ? [m[0]] : undefined,
      pattern: check.pattern,
      hint: check.hint,
    };
  }

  // semantic
  if (studentVec === null) {
    return { kind: 'semantic', status: CHECK_STATUSES.SKIPPED_EMBEDDER, hint: check.hint };
  }
  if (wordCount < (check.minWords ?? 3)) {
    return { kind: 'semantic', status: CHECK_STATUSES.SKIPPED_TOO_SHORT, hint: check.hint };
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
    status: best.score >= check.threshold ? CHECK_STATUSES.PASS : CHECK_STATUSES.FAIL,
    score: best.score,
    bestAnchor: best,
    anchorScores: debug ? scores : undefined,
    hint: check.hint,
  };
}

function evaluateVeto(veto: Veto, normalized: string): VetoStatus {
  if (veto.kind === 'literal') {
    return veto.terms.some((t) => matchesWord(normalized, t))
      ? VETO_STATUSES.TRIGGERED
      : VETO_STATUSES.NOT_TRIGGERED;
  }
  const re = compileRegex(veto);
  if (re === null) return VETO_STATUSES.SKIPPED_BAD_REGEX;
  return re.test(normalized) ? VETO_STATUSES.TRIGGERED : VETO_STATUSES.NOT_TRIGGERED;
}

function evaluateMisconception(m: Misconception, normalized: string): MisconceptionStatus {
  const re = compileRegex(m);
  if (re === null) return VETO_STATUSES.SKIPPED_BAD_REGEX;
  return re.test(normalized) ? VETO_STATUSES.TRIGGERED : VETO_STATUSES.NOT_TRIGGERED;
}

function isSkipped(s: CheckStatus): boolean {
  return (
    s === CHECK_STATUSES.SKIPPED_EMBEDDER ||
    s === CHECK_STATUSES.SKIPPED_TOO_SHORT ||
    s === CHECK_STATUSES.SKIPPED_BAD_REGEX
  );
}

// Unicode-aware whole-word match. JS `\b` is ASCII-only, so "uafhængig" would
// otherwise satisfy a literal check for "afhængig". The `\p{L}\p{N}` lookarounds
// (with `u` flag) make boundaries respect Danish letters on either side.
const WORD_RE_CACHE = new Map<string, RegExp>();
function matchesWord(haystack: string, term: string): boolean {
  let re = WORD_RE_CACHE.get(term);
  if (!re) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
    WORD_RE_CACHE.set(term, re);
  }
  return re.test(haystack);
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
