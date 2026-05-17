Act as the primary implementation agent for this repository.

Read the current plan from:
.agents/plans/current-plan.md

Read Codex plan findings from:
.agents/plans/codex-plan-findings.md

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
.agents/plans/claude-plan-response.md

Do not edit source files, tests, or product documentation while applying plan findings unless the user explicitly asks you to continue into implementation.
Do not run npm run verify for plan-only changes.

After updating the plan:
- report which findings were accepted, rejected, or deferred
- mention any remaining planning risk or unresolved question
- state whether the plan is ready for implementation

Do not begin implementation. Wait for explicit user sign-off on the updated plan before changing any source files, tests, or product documentation. The user acts as the second critique pass — if they push back on a rejection or want a finding revisited, revise the plan and response again before proceeding.
