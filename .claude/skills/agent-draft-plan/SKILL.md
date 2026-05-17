---
name: agent-draft-plan
description: Interview the user about a task, then draft an implementation plan under .agents/plans/<slug>/plan.md. Use when the user wants to begin a new agent-workflow task (e.g. "/agent-draft-plan refactor the rubric engine") or types "/agent-draft-plan" with no arg. The drafted plan is the input to /agent-plan-loop. Do not implement yet — this skill only writes the plan file.
---

# agent-draft-plan

Interview the user about a new task, then draft an implementation plan at `.agents/plans/<slug>/plan.md`. The drafted plan is the input to `/agent-plan-loop`; implementation happens in regular conversation after sign-off.

This skill is **pure planning**: it never edits source files, tests, or product docs. Only the plan artifact.

## Inputs

The user types `/agent-draft-plan [task-description]`. The description is optional — if omitted, ask: "What's the task? Paste a brief or describe what we're building."

## Slug derivation

Propose a short kebab-case slug from the task description (e.g. "Refactor the rubric engine" → `rubric-engine-refactor`). Avoid generic stems like "fix" or "update"; pick the noun-phrase that names the work. Surface the proposed slug to the user with `AskUserQuestion` before writing anything to disk:

> Proposed slug: `<slug>`. Use this, or pick a different one?

On confirmation, the slug is fixed for the rest of the task's lifecycle. The user can override via free-text.

## Pre-flight: collision check

If `.agents/plans/<slug>/` already exists, surface what's there. Read its `plan.md` title (first H1) and list which sibling artifacts are present (`codex-plan-findings.md`, `claude-plan-response.md`, presence of `<!-- converged -->` marker, presence of `.agents/reviews/<slug>/`). Then ask via `AskUserQuestion`:

- **Resume** — skip drafting; suggest `/agent-plan-loop <slug>` instead (don't run it automatically). Exits.
- **Archive and restart** — `Move-Item .agents/plans/<slug> .agents/plans/archive/<slug>-<timestamp>` (create `.agents/plans/archive/` if needed). Then proceed with a clean folder.
- **Pick a different slug** — go back to slug derivation.

Wait for explicit answer. Do not auto-archive without confirmation.

If the folder doesn't exist, create it via `New-Item -ItemType Directory -Path .agents/plans/<slug> -Force`.

## Interview

Before drafting the plan body:

1. Read these files in this order:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `SPEC.md`
   - Any nested `CLAUDE.md` files under paths the task description hints at (use Grep/Glob to find them).

2. Identify ambiguities along these axes — for each, is it specified clearly enough to draft?
   - **Goal**: what does "done" look like for this task?
   - **Scope boundary**: what's explicitly NOT in this task?
   - **Constraints**: any hard requirements (perf, accessibility, SPEC sections, deadline)?
   - **Stakeholder**: who else depends on this landing?
   - **Success criterion**: how will we verify it works?
   - **Affected seams**: which of `src/lab-guide/`, `src/sim-contract/`, `src/content/`, `src/simulations/`, `src/lib/` does this touch?

3. Ask the user in batches via `AskUserQuestion` (when you have 2–4 discrete options) or plain text (open-ended). Continue until none of the axes are ambiguous.

If product behavior is ambiguous, SPEC.md wins over CLAUDE.md and AGENTS.md.

Do not guess. Stop and ask if any of: the task description is unclear about "done", multiple plausible implementations exist, a constraint isn't named, or you'd otherwise be filling in details from assumption.

## Draft

Render `.agents/prompts/claude-draft-plan.md` as the spec, with the substitution:

- `${PLAN_PATH}` → `.agents/plans/<slug>/plan.md`

Follow the prompt's structure (title, task summary, requested outcome, assumptions, SPEC interpretation, affected files, architecture-seam check, implementation steps with success criteria, test plan, Codex-scrutiny list).

Write only the plan artifact at `.agents/plans/<slug>/plan.md`. Do not edit source, tests, or docs.

## After drafting

End with:

> Plan written to `.agents/plans/<slug>/plan.md`. Next: run `/agent-plan-loop <slug>` to iterate the plan with Codex review.

Do NOT auto-invoke `/agent-plan-loop`. The user starts the loop deliberately.

## What NOT to do

- Do not edit source files, tests, or product documentation. Plan-only.
- Do not run `npm run verify` or any test commands. Plan-only.
- Do not auto-archive an existing `<slug>/` folder without explicit user confirmation.
- Do not invoke `/agent-plan-loop` for the user. Let them start the loop when ready.
- Do not skip the interview when the task description is vague. "I'll figure it out from SPEC" is the failure mode this skill exists to prevent.
