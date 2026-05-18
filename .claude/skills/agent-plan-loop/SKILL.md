---
name: agent-plan-loop
description: Run the Codex plan-review ↔ Claude apply-findings loop on an existing plan under .agents/plans/<slug>/plan.md, until convergence or iteration cap. Use after /agent-draft-plan has produced a plan and the user is ready to iterate it ("/agent-plan-loop", "/agent-plan-loop <slug>", or "iterate the plan with Codex"). Stops on no open P0/P1 + no new finding IDs + no drift; halts at iteration cap=4. The user signs off in conversation; this skill never invokes implementation itself.
---

# agent-plan-loop

Run the plan-review iteration loop on `.agents/plans/<slug>/plan.md`. Each round: Codex plan-reviews → Claude applies findings → repeat until convergence or cap.

This skill never edits source files, tests, or product docs. It only edits the plan + plan-loop artifacts under `.agents/plans/<slug>/`.

## Inputs

The user types `/agent-plan-loop [<slug>]`. Slug is optional.

## Slug resolution

- **If arg given**: use it. If `.agents/plans/<slug>/plan.md` doesn't exist, print "No plan found at `.agents/plans/<slug>/plan.md`. Try `/agent-draft-plan` first." and exit.
- **If arg omitted**: scan `.agents/plans/*/plan.md`. Filter to **incomplete plans** — those whose `claude-plan-response.md` either doesn't exist or contains neither `<!-- converged -->` nor `<!-- signed-off -->`.
  - If exactly one match: use it. Print the slug being used so the user can correct.
  - If zero: print "No in-progress plans found. Try `/agent-draft-plan` first." and exit.
  - If multiple: list them with their titles + last-modified times and use `AskUserQuestion` to pick.

## Pre-flight

- Verify `scripts/run-codex.ps1` exists. If not, print a hint to create it (this skill depends on the wrapper) and exit.
- Print: `Plan loop starting for slug=<slug>. Mode=<cli|manual> (from $env:CODEX_MODE). Max iterations: 4. Stops on: no open P0/P1 + no new finding IDs + no drift under old IDs.`

## Loop

The loop runs **inside this skill body** — you (Claude) are the loop driver. For iteration `N` from 1 to 4:

### 1. Snapshot the plan

`Copy-Item .agents/plans/<slug>/plan.md .agents/plans/<slug>/round-N/plan.before.md` (create the round folder with `New-Item -ItemType Directory -Force`).

### 2. Render the Codex prompt

Read `.agents/prompts/codex-review-plan.md` and substitute the templated paths:

- `${PLAN_PATH}` → `.agents/plans/<slug>/plan.md`
- `${FINDINGS_PATH}` → `.agents/plans/<slug>/codex-plan-findings.md`
- `${PRIOR_FINDINGS_PATH}` → `.agents/plans/<slug>/round-(N-1)/codex-plan-findings.md` (empty string for N=1)
- `${PRIOR_RESPONSE_PATH}` → `.agents/plans/<slug>/round-(N-1)/claude-plan-response.md` (empty string for N=1)

Write the rendered prompt to `.agents/plans/<slug>/round-N/codex-prompt.rendered.md` (snapshot for audit; also serves as the paste source in manual mode).

### 3. Invoke Codex

Run:

```
scripts/run-codex.ps1 -RenderedPromptFile .agents/plans/<slug>/round-N/codex-prompt.rendered.md -OutputFile .agents/plans/<slug>/codex-plan-findings.md
```

The wrapper picks CLI or manual mode from `$env:CODEX_MODE`.

**If `$env:CODEX_MODE` is `'manual'` or unset:**
The wrapper writes the rendered prompt to disk and returns immediately (no blocking). After the wrapper exits, pause the loop with `AskUserQuestion`:

> Have you pasted Codex's review from `.agents/plans/<slug>/round-N/codex-prompt.rendered.md` into Codex and saved Codex's response to `.agents/plans/<slug>/codex-plan-findings.md`?
>
> - **Yes — continue** — proceed to step 4.
> - **Abort** — exit the loop without applying anything.

The Bash tool call must not block. The conversation does.

**If `$env:CODEX_MODE` is `'cli'`:** wrapper runs `codex.cmd exec` synchronously and writes the findings file itself. Proceed directly to step 4.

### 4. Snapshot findings

`Copy-Item .agents/plans/<slug>/codex-plan-findings.md .agents/plans/<slug>/round-N/codex-plan-findings.md`.

### 5. Parse findings

From `codex-plan-findings.md`, extract:

- `idsThisRound` — all finding IDs (PL1, PL2, ...) present.
- `openP0P1Count` — count of findings with severity P0 or P1 that don't already have a "resolved" / "closed" / "accepted and applied" marker.
- `newIdsVsLastRound` — IDs in `idsThisRound` but NOT in `round-(N-1)/codex-plan-findings.md`. For N=1, this equals `idsThisRound`.
- `changedTextUnderOldId` — for each ID present in both this round and the prior round, compare the "what is wrong" / "why it matters" body text. Substantive changes count as drift.

### 6. Apply findings

Render `.agents/prompts/claude-apply-plan-findings.md` with the same path substitutions (`${PLAN_PATH}`, `${FINDINGS_PATH}`, `${RESPONSE_PATH}` = `.agents/plans/<slug>/claude-plan-response.md`).

Follow the rendered prompt — read CLAUDE.md / AGENTS.md / SPEC.md and any nested CLAUDE.md for files the plan touches, then for each finding decide accept / accept-deferred / reject, apply the smallest plan edit, and append a round-N section to `claude-plan-response.md` recording the decision per finding ID.

**You are in loop mode** (`/agent-plan-loop` invocation): do NOT pause for user sign-off after applying findings; the stop check (step 8) is the gate. P0 findings that require a user decision (between non-trivial design alternatives) still pause via `AskUserQuestion` before continuing.

### 7. Snapshot post-apply state

```
Copy-Item .agents/plans/<slug>/plan.md .agents/plans/<slug>/round-N/plan.after.md
Copy-Item .agents/plans/<slug>/claude-plan-response.md .agents/plans/<slug>/round-N/claude-plan-response.md
```

### 8. Stop check

- If `openP0P1Count == 0` AND `newIdsVsLastRound == 0` AND `changedTextUnderOldId == 0` AND `N > 1` → **converged**. Append `<!-- converged -->` to `.agents/plans/<slug>/claude-plan-response.md`. Go to exit summary.
- If `N == 4` → **iteration cap reached**. Do NOT append `<!-- converged -->`. Go to exit summary, which uses `AskUserQuestion` to decide whether to append `<!-- signed-off -->`.
- Else → continue to round `N+1`.

## Exit summary

Print one paragraph:

- Slug, iteration count, convergence status (converged / iteration-cap).
- For converged: link to `.agents/plans/<slug>/claude-plan-response.md` and prompt the user: "Reply `approve <slug>` to proceed to implementation, or revise the plan first."
- For iteration-cap: list the remaining open P0/P1 (and P2/P3 if any), then use `AskUserQuestion` to record the decision in the audit trail:

  > Iteration cap reached for slug=`<slug>` without convergence. Remaining: `<short summary, e.g. "2 P2, 1 P3, no P0/P1">`. How do you want to exit?
  >
  > - **Sign off with caveats** — append `<!-- signed-off -->` to `claude-plan-response.md` with a one-line note (date + remaining-findings summary). This unblocks `/agent-review-loop`.
  > - **Push another manual round** — exit without a marker; user re-runs `/agent-plan-loop <slug>` to push round 5+.
  > - **Revise plan** — exit without a marker; user edits `plan.md` directly before any further loop.

  On "sign off with caveats", append to `.agents/plans/<slug>/claude-plan-response.md` — the bare marker first (so a literal substring check matches), then a separate annotation comment on the next line:

  ```
  <!-- signed-off -->
  <!-- signed-off context: <YYYY-MM-DD> after iteration cap. Remaining: <summary>. -->
  ```

  Do NOT append `<!-- converged -->` in this path — the two markers are semantically distinct (`converged` = loop reached zero open findings + no drift; `signed-off` = user accepted caveats past the cap). Both unlock `/agent-review-loop`; keeping them distinct preserves the audit trail.

## What NOT to do

- Do not edit source files, tests, or product documentation. Plan-loop only.
- Do not invoke the implementation phase yourself — the user signs off in conversation.
- Do not skip the prior-context substitution in step 2 — without it, the convergence rule is unreliable (Codex can re-use IDs for different issues).
- Do not block the Bash tool call in manual mode — the wrapper returns immediately; pause the conversation with `AskUserQuestion` instead.
- Do not auto-archive a converged plan. The user decides when to archive.
- Do not run `npm run verify` — this is plan-only.
