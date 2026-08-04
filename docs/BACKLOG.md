# BACKLOG

A parking lot for ideas and open work that aren't on the immediate path. Not a commitment — items here may be picked up, deferred indefinitely, or dropped.

**How to add an entry:** under the relevant area, write the idea as a short heading and a one-line **Why:** rationale. If you can't articulate the why in a sentence, the idea isn't ready.

**Areas mirror the codebase seams** (see [CLAUDE.md](../CLAUDE.md) → Architecture).

---

## Framework

### Sim-gate phase-scoping
Phase-scope `milestone` and `data-points` gates via per-phase buckets; leave `predicate` global. Recommendation drafted 2026-05-10, awaiting decision.
**Why:** sim mounts once per lab, so a student on phase 1 can satisfy gates for phases 2–4. Pedagogical leak.

### Extract widget-registration hook (R-B1)
**Why:** the `registerWidgetState` + `setTick` dance is repeated across widgets and easy to get subtly wrong.
**Update (2026-08-04):** now easier to design — the VariableTable split (see STATUS.md) isolated one caller's version of the dance in `VariableTable.tsx` on its own, giving the cross-widget abstraction a concrete second data point to design against once `RubricResponse.tsx` (below) is similarly decomposed.

### i18n cluster (B-1, C-2, C-3, C-4)
**Why:** Danish strings still leak into framework code in places; consolidating around [src/lab-guide/strings.da.ts](../src/lab-guide/strings.da.ts) would tighten SPEC §17 compliance.

---

## Widgets

### `evaluateRowGroup` is ~186 lines
In `variableTableCorrectness.ts` — the one long function in an otherwise well-decomposed pure module.
**Why:** it was left alone deliberately during the VariableTable split (2026-08-04); it is the remaining structural outlier in that file.

### `RubricResponse.tsx` is 855 lines
Same shape as pre-split `VariableTable.tsx` (1786 lines).
**Why:** same disease; the hint plumbing now extracted for VariableTable (`variableTableHints.ts`, `useVariableTableUnlockSession.ts`) may make that job much smaller.

### `resolveSpend` untested against a dirty section
In `variableTableHints.test.ts` (19 tests, all passing), no test exercises `resolveSpend` with a dirty section.
**Why:** adding `if (!ctx.sectionClean[section]) return null;` to `resolveSpend` would pass all 19 tests while changing behavior — the gate is unreachable in practice (the spend affordance only renders when `nextTier !== null`), but the suite does not pin it.

### Per-widget "is satisfied" indicator on FreeTextResponse
**Why:** with multiple FreeTextResponse instances under one `all-filled` gate, students can't see *which* sub-tasks are done — only the global next-button state.

### Hint-surfacing flexibility (`tooShortMessage` timing)
**Why:** the below-threshold hint shows immediately on first keystroke; can feel naggy. Timed / tries / submit-triggered modes would let authors pace hints to the prompt.

### Per-group hints on keyword-mode FreeTextResponse
**Why:** the engine in [src/lib/textMatch.ts](../src/lib/textMatch.ts) already returns `perGroup.hint`; FreeTextResponse only renders the count. Chrome + pacing decision still open.

### `textMatch` exact mode
**Why:** `kind: 'exact'` is implemented and tested but no widget consumes it. Will land with the future variable-identification widget.

### Per-lab visual variation on widgets
**Why:** all Quizzes/Checklists look identical across labs by design. If a future assessment-style lab needs a different look, prefer a curated `variant` enum over per-instance `className`.

---

## Simulations

*(No standing items.)*

---

## Rubric engine

### Tighten `template-hypothesis.json` against gibberish-with-key-tokens
Manual review 2026-05-15 found that *"noget med y og x men lige hvad j jv jv stiger"* clears all three required criteria of the template rubric: `iv` and `dv` via semantic-on-bare-token (`x` / `y` alone scores above 0.85 against anchors whose dominant token is the same symbol), and `relation` via the loose single-clause regex picking up `stiger`. Fix is (a) drop semantic from `iv`/`dv` and replace with literal/regex requiring both the concept word (`uafhængig`/`afhængig`) and the symbol mention, and (b) tighten the `relation` regex to bind the change verb to X/Y (clause-shape pattern), mirroring the `rubric-test` v2 calibration.
**Why:** the rubric engine isn't broken — the template rubric is too lenient for what it gates. Specific-claim criteria aren't safely gateable on semantic alone (Phase 1 calibration conclusion), and the template rubric is the copyable teaching example, so it has to model the right pattern.

### Coherence check kind
A new rubric check kind (alongside `semantic` / `regex` / `literal`) that asks "is this a coherent answer at all?" rather than "does it contain the required claim?". Sentence-transformer embeddings can't do this — they're trained for meaning-similarity, not fluency, and a short input with the right salient tokens lands close to anchors regardless of whether the connecting words make sense. Candidate implementations: small-LM perplexity, dictionary-word ratio / lexical density, or an LLM-judge call. Would compose with the existing kinds (e.g. a criterion could require `coherence` AND a literal claim).
**Why:** today's review showed gibberish-with-key-tokens passes the rubric. Tightening individual rubrics (above) closes the specific holes, but a coherence kind would be a structural fix — and the Phase 1 calibration already concluded that fluency is fundamentally outside the embedder's job. Deferred until a real lab needs it; design and model choice are open.

---

## Content

*(No standing items. Lab-specific work is tracked in memory; entries here would be patterns or conventions cutting across labs.)*

---

## Skills

### `/review-lab <slug>`
**Why:** single skill, four checks (SPEC compliance, Danish quality, didactic structure, accessibility). Output is a chat report — no file edits. Next in the agreed roadmap.

### `/new-lab <topic>/<slug>`
**Why:** scaffolds the full experiment folder (frontmatter, `theory.mdx`, 7 phase MDX stubs). Structure-only; teacher authors the prose.

### `/bump-experiment-version <slug>`
**Why:** diffs current frontmatter against `git show HEAD:…/index.ts`; bumps `frontmatter.version` when phase ids or gate structure change. The easy-to-forget bookkeeping that silently wipes student state.
