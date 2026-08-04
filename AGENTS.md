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

Multi-step tasks (brainstorming, planning, subagent-driven implementation with code review, systematic debugging, TDD) use the `superpowers` plugin (`claude-plugins-official` marketplace), enabled via `enabledPlugins` in `.claude/settings.json`.

Historical per-task artifacts from the previous Codex-based plan/review loop remain under `.agents/plans/<slug>/` and `.agents/reviews/<slug>/` for reference.
