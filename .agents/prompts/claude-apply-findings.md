Act as the primary implementation agent for this repository.

Read Codex findings from:
.agents/reviews/codex-findings.md

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

After fixes:
- run npm run verify
- write your finding-by-finding response to .agents/reviews/claude-response.md
- report which findings were accepted, rejected, or fixed
- mention any remaining risk or verification failure
