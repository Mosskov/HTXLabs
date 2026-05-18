---
name: agent-review-loop
description: Run the Codex code-review ↔ Claude apply-findings loop on the current diff after implementation, until convergence or iteration cap. Use after a plan has been signed-off and implementation is complete ("/agent-review-loop", "/agent-review-loop <slug>", or "review my changes with Codex"). Stops on no open P0/P1 + no new finding IDs + no drift; halts at iteration cap=4. Runs full `npm run verify` once at convergence (deferred during intermediate rounds). Never pushes to git — that stays manual.
---

# agent-review-loop

Run the code-review iteration loop on the current implementation diff. Each round: Codex reviews the diff → Claude applies findings → repeat until convergence or cap. Runs full `npm run verify` once on exit.

This skill edits source files (per Codex's findings) and writes artifacts under `.agents/reviews/<slug>/`. It never pushes or commits.

## Inputs

The user types `/agent-review-loop [<slug>]`. Slug is optional.

## Slug resolution

- **If arg given**: use it. The plan at `.agents/plans/<slug>/plan.md` must exist AND `.agents/plans/<slug>/claude-plan-response.md` must contain `<!-- converged -->` or `<!-- signed-off -->`. If not, print "Plan for slug=<slug> hasn't been signed off via `/agent-plan-loop` yet (no `<!-- converged -->` or `<!-- signed-off -->` marker). Iterate the plan first, or re-run `/agent-plan-loop <slug>` and choose 'Sign off with caveats' at the cap-exit." and exit. If the marker is `<!-- signed-off -->`, print a heads-up: "Note: plan was signed off past iteration cap (not auto-converged). Remaining caveats are in the plan response."
- **If arg omitted**: scan `.agents/plans/*/claude-plan-response.md` for plans with either `<!-- converged -->` or `<!-- signed-off -->`. Filter to those whose `.agents/reviews/<slug>/claude-response.md` either doesn't exist or doesn't have `<!-- converged -->`.
  - If exactly one match: use it.
  - If zero: print "No converged plans awaiting code review. Either run `/agent-plan-loop <slug>` first, or pass an explicit slug." and exit.
  - If multiple: list and use `AskUserQuestion` to pick.

Create `.agents/reviews/<slug>/` via `New-Item -ItemType Directory -Force` if it doesn't exist.

## Pre-flight: source-file collision check

Read the plan's "Likely affected files" section (or "Files to create/update" — look for a markdown table or list near the top) and collect the file paths into a `touchedFiles` set. If the plan has no such section, fall back to the working-tree set: `git diff --name-only HEAD` **plus** `git ls-files --others --exclude-standard` (the latter so untracked new files aren't dropped from the audit trail).

Run `git status --porcelain` and parse the modified-files list. For each modified file NOT in `touchedFiles`, flag it as a potential collision with another active task.

If collisions exist, surface them with `AskUserQuestion`:

> The following files are modified in your working tree but are NOT in this plan's expected touch-set:
>
> - `path/to/file-1.ts`
> - `path/to/file-2.tsx`
>
> They may belong to another active task. Options:
>
> - **Proceed anyway** — these will be in scope for the review. Logged to `.agents/reviews/<slug>/touched.txt`.
> - **Abort** — exit the loop. Check other windows first.

On "proceed anyway", append the collision paths to `.agents/reviews/<slug>/touched.txt` (create the file if needed; one path per line) along with the original touched-files list. This file is the audit trail of what the loop considered in-scope.

If no collisions, write the plan's touched-files list to `.agents/reviews/<slug>/touched.txt` as the baseline.

## Pre-flight (continued)

- Verify `scripts/run-codex.ps1` exists.
- Print: `Review loop starting for slug=<slug>. Mode=<cli|manual>. Max iterations: 4. Stops on: no open P0/P1 + no new finding IDs + no drift. Full npm run verify deferred to convergence.`

## Loop

The loop runs inside this skill body. For iteration `N` from 1 to 4:

### 1. Snapshot current diff

`git diff HEAD > .agents/reviews/<slug>/round-N/diff.before.patch` (create round folder via `New-Item -ItemType Directory -Force`).

`git diff HEAD` omits untracked files. Append a no-index diff for each so the audit trail captures the full state of new files:

```pwsh
foreach ($f in (git ls-files --others --exclude-standard)) {
  git --no-pager diff --no-index /dev/null -- $f 2>$null | Add-Content .agents/reviews/<slug>/round-N/diff.before.patch
}
```

(Same treatment for `diff.after.patch` after step 6.)

### 2. Render the Codex prompt

Read `.agents/prompts/codex-review.md` and substitute:

- `${FINDINGS_PATH}` → `.agents/reviews/<slug>/codex-findings.md`
- `${PRIOR_FINDINGS_PATH}` → `.agents/reviews/<slug>/round-(N-1)/codex-findings.md` (empty for N=1)
- `${PRIOR_RESPONSE_PATH}` → `.agents/reviews/<slug>/round-(N-1)/claude-response.md` (empty for N=1)

Write the rendered prompt to `.agents/reviews/<slug>/round-N/codex-prompt.rendered.md`.

### 3. Invoke Codex

```
scripts/run-codex.ps1 -RenderedPromptFile .agents/reviews/<slug>/round-N/codex-prompt.rendered.md -OutputFile .agents/reviews/<slug>/codex-findings.md
```

If `$env:CODEX_MODE` is `'manual'` or unset, the wrapper returns immediately after writing the rendered prompt. Pause with `AskUserQuestion`:

> Have you pasted Codex's review from `.agents/reviews/<slug>/round-N/codex-prompt.rendered.md` into Codex and saved Codex's response to `.agents/reviews/<slug>/codex-findings.md`?
>
> - **Yes — continue**
> - **Abort**

If CLI mode, proceed directly to step 4.

### 4. Snapshot findings

`Copy-Item .agents/reviews/<slug>/codex-findings.md .agents/reviews/<slug>/round-N/codex-findings.md`.

### 5. Parse findings

From `codex-findings.md`, extract:

- `idsThisRound` — all C-IDs (C1, C2, ...) present.
- `openP0P1Count` — count of P0/P1 findings without a resolved marker.
- `newIdsVsLastRound` — IDs in `idsThisRound` but NOT in `round-(N-1)/codex-findings.md`. For N=1, equals `idsThisRound`.
- `changedTextUnderOldId` — substantive body-text changes under IDs present in both rounds.

### 6. Apply findings

Render `.agents/prompts/claude-apply-findings.md` with the path substitutions (`${FINDINGS_PATH}`, `${RESPONSE_PATH}` = `.agents/reviews/<slug>/claude-response.md`).

Follow the rendered prompt — read repository guidance, then for each finding apply the smallest surgical fix to source files (per the finding ID), and append a round-N section to `claude-response.md`.

**Loop-mode discipline** (per the rendered prompt's "Loop mode" section):

- Run only **targeted Vitest files** for the changed code: `npm test -- --run <path>`. Do NOT run the full `npm run verify` between rounds.
- Do NOT pause for user sign-off after applying — step 8 (stop check) is the gate.
- P0 findings requiring a user decision still pause via `AskUserQuestion`.

### 7. Snapshot post-apply state

```
git diff HEAD > .agents/reviews/<slug>/round-N/diff.after.patch
Copy-Item .agents/reviews/<slug>/claude-response.md .agents/reviews/<slug>/round-N/claude-response.md
```

### 8. Stop check

- If `openP0P1Count == 0` AND `newIdsVsLastRound == 0` AND `changedTextUnderOldId == 0` AND `N > 1` → **converged**. Go to convergence exit.
- If `N == 4` → **iteration cap reached**. Go to cap exit.
- Else → continue to round `N+1`.

## Convergence exit

1. Run the deferred full verify **first**: `npm run verify`. Capture pass/fail.
2. **Only on pass**, append `<!-- converged -->` to `.agents/reviews/<slug>/claude-response.md`. On fail, do NOT append the marker — the slug must remain discoverable for the next `/agent-review-loop` scan so the failure can be addressed.
3. Print summary:
   - Slug, iteration count, converged.
   - Touched files (from `touched.txt`).
   - `npm run verify` result.
   - On pass: "Diff is ready for review. Run `git diff` to inspect, then `git commit` + `git push` when satisfied. **This skill never pushes.**"
   - On fail: surface the first failing command + output, and print: "Convergence reached on findings, but `npm run verify` failed. Marker not written. Fix the failure manually or re-run `/agent-review-loop <slug>` after a fix attempt."

## Cap exit

1. Do NOT append converged marker.
2. List remaining open findings by severity, with their IDs.
3. Run the deferred full verify and report the result.
4. Print: "Iteration cap reached without convergence. Decide: revise + re-run, or sign off with caveats. **This skill never pushes.**"

## What NOT to do

- Do not run `git commit`, `git push`, or any other write-to-remote git operation. The user controls those.
- Do not skip the source-file collision preflight — it's the only defense against two parallel review loops clobbering each other.
- Do not run the full `npm run verify` between rounds. Only targeted Vitest files. The full verify runs once at exit.
- Do not skip the prior-context substitution in step 2 — ID stability depends on it.
- Do not block the Bash tool call in manual mode — use `AskUserQuestion` for the conversational pause.
- Do not edit `.agents/plans/<slug>/` artifacts. Plan is read-only this phase.
