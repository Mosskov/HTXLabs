Act as the primary implementation agent for this repository.

Input/output paths in this prompt are templated:
- `${PLAN_PATH}` — the plan to edit (defaults to `.agents/plans/<slug>/plan.md`).
- `${FINDINGS_PATH}` — Codex findings to apply (defaults to `.agents/plans/<slug>/codex-plan-findings.md`).
- `${RESPONSE_PATH}` — where to append your finding-by-finding response (defaults to `.agents/plans/<slug>/claude-plan-response.md`).

Read the current plan from:
${PLAN_PATH}

Read Codex plan findings from:
${FINDINGS_PATH}

Do not blindly apply the findings.

Before changing the plan, follow repository guidance:
- read CLAUDE.md
- read AGENTS.md
- read SPEC.md
- read any nested CLAUDE.md for files the plan expects to touch

For each Codex plan finding:
- keep the same finding ID: PL1, PL2, PL3, ...
- decide whether it is valid
- if invalid, briefly explain why
- if valid, make the smallest surgical update to .agents/plans/current-plan.md
- do not add speculative behavior
- do not expand scope beyond the user's request
- preserve the architecture seams described in CLAUDE.md

For each finding, report one of:
- accepted and plan updated
- accepted but deferred, with reason
- rejected, with reason

Write your finding-by-finding response to:
${RESPONSE_PATH}

Do not edit source files, tests, or product documentation while applying plan findings unless the user explicitly asks you to continue into implementation.
Do not run npm run verify for plan-only changes.

After updating the plan:
- report which findings were accepted, rejected, or deferred
- mention any remaining planning risk or unresolved question
- state whether the plan is ready for implementation

## Loop mode

When this prompt is invoked by `/agent-plan-loop` (the skill body will tell you so), the user sign-off step is handled by the skill's stop condition, not by you. Behavior changes:
- After applying findings, do not pause for user sign-off — let the skill check the stop condition (no open P0/P1 + no new finding IDs + no drift under old IDs) and decide whether to loop again.
- Findings whose application **requires** a user decision (e.g. P0 that branches between two non-trivial design alternatives) still pause the loop — surface them clearly so the skill knows to ask the user before continuing.
- Outside loop mode, the sign-off paragraph below still applies.

Do not begin implementation. Wait for explicit user sign-off on the updated plan before changing any source files, tests, or product documentation. The user acts as the second critique pass — if they push back on a rejection or want a finding revisited, revise the plan and response again before proceeding.
