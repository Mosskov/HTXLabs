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

### i18n cluster (B-1, C-2, C-3, C-4)
**Why:** Danish strings still leak into framework code in places; consolidating around [src/lab-guide/strings.da.ts](../src/lab-guide/strings.da.ts) would tighten SPEC §17 compliance.

---

## Widgets

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
