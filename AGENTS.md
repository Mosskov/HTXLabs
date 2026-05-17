# Codex guidance

Claude Code is the primary agent for this repository.

Canonical project guidance lives in CLAUDE.md. Read it before making changes.

Also read:
- SPEC.md, which is the source of truth
- any nested CLAUDE.md under files you touch

If product behavior is ambiguous, SPEC.md wins over both CLAUDE.md and AGENTS.md.

Use `npm run verify` before declaring work done.

Do not edit the same files as another active agent unless explicitly instructed.

## Agent workflow skills

For multi-step tasks, the project provides three slash-command skills that wrap the existing prompts in `.agents/prompts/` into automated loops:

- `/agent-draft-plan [description]` — interview + draft. Writes `.agents/plans/<slug>/plan.md`.
- `/agent-plan-loop [<slug>]` — Codex plan-review ↔ Claude apply-findings until convergence or iteration cap (4).
- `/agent-review-loop [<slug>]` — Codex code-review ↔ Claude apply-findings on the implementation diff, same loop shape. Defers full `npm run verify` until convergence, then runs it once. Never pushes to git.

Per-task artifacts live under `.agents/plans/<slug>/` and `.agents/reviews/<slug>/`, allowing concurrent tasks. See `.claude/skills/agent-*/SKILL.md` for the loop bodies and `scripts/run-codex.ps1` for the Codex invocation wrapper (CLI vs. manual-paste mode via `$env:CODEX_MODE`).
