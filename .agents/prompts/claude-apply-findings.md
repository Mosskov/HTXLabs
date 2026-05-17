Act as the primary implementation agent for this repository.

Input/output paths in this prompt are templated:
- `${FINDINGS_PATH}` — Codex findings to apply (defaults to `.agents/reviews/<slug>/codex-findings.md`).
- `${RESPONSE_PATH}` — where to append your finding-by-finding response (defaults to `.agents/reviews/<slug>/claude-response.md`).

Read Codex findings from:
${FINDINGS_PATH}

Do not blindly apply them.

Before making changes, follow repository guidance:
- read CLAUDE.md
- read AGENTS.md
- read SPEC.md
- read any nested CLAUDE.md for files you touch

For each Codex finding:
- keep the same finding ID: C1, C2, C3, ...
- decide whether it is valid
- if invalid, briefly explain why
- if valid, make the smallest surgical fix
- do not refactor unrelated code
- do not introduce speculative behavior
- preserve the architecture seams described in CLAUDE.md

For each finding, report one of:
- accepted and fixed
- accepted but deferred, with reason
- rejected, with reason

For each finding write:
- id: C1, C2, C3, ...
- status: one of the three above
- file/line if a fix was applied
- short rationale for the decision

After fixes:
- run only targeted Vitest files for the changed code (see Loop mode below for when to defer the full verify)
- write your finding-by-finding response to ${RESPONSE_PATH}
- report which findings were accepted, rejected, or fixed
- mention any remaining risk or verification failure

## Loop mode

When this prompt is invoked by `/agent-review-loop` (the skill body will tell you so), the user sign-off step is handled by the skill's stop condition, not by you. Behavior changes:

- **Defer the full `npm run verify`.** In intermediate rounds, run only targeted Vitest files relevant to the changed code (`npm test -- --run path/to/file.test.tsx`). The skill runs the full `npm run verify` once after the loop converges (or hits the iteration cap) and reports the result. This is the only way the loop stays fast — running lint + full tests + build every round is wasteful.
- **Do not pause for user sign-off** after applying — let the skill check the stop condition (no open P0/P1 + no new finding IDs + no drift under old IDs) and decide whether to loop again.
- Findings whose application **requires** a user decision (e.g. P0 that branches between non-trivial alternatives) still pause the loop — surface them clearly so the skill knows to ask the user before continuing.

Outside loop mode, run the full `npm run verify` per AGENTS.md before declaring work done.
