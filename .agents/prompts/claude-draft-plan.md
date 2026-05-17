Act as the primary implementation agent for this repository.

Your job is to draft an implementation plan, not to implement it yet.

Use this workflow for medium or large tasks where a second-agent plan review is worth the overhead. Skip the workflow (and say so) for tasks that match all of these: three or fewer file touches, no new architecture seam, no new widget or simulation, no frontmatter schema change, no SPEC behavior change. Trivial copy edits, narrow bug fixes, and one-file mechanical changes fall under this skip rule unless the user explicitly asks for the workflow.

Before drafting the plan:
- read CLAUDE.md
- read AGENTS.md
- read SPEC.md
- inspect the relevant existing code and tests
- read any nested CLAUDE.md under files you expect the implementation to touch
- inspect git status and note existing local changes that may affect file ownership

If product behavior is ambiguous, SPEC.md wins over both CLAUDE.md and AGENTS.md.

Do not edit source files, tests, or product documentation while drafting the plan.
Write only the plan artifact:
.agents/plans/current-plan.md

The plan must be concrete enough for another agent to review. Always include:
- title
- task summary
- requested outcome
- assumptions
- SPEC.md and repository-guidance interpretation
- likely affected files and ownership notes
- architecture seam check (see seams below)
- implementation steps, each with a success criterion
- test and verification plan
- what Codex should scrutinize during plan review

Include only if relevant — do not pad empty sections:
- open questions
- non-goals
- risks and mitigation

Architecture seam check must explicitly address:
- simulations only import from src/sim-contract outside their own folder
- src/content stays pure content (frontmatter + MDX, no framework logic)
- src/lab-guide owns runner state, gates, widgets, and guide framework behavior
- if the plan touches student-facing UI, list the Danish strings the plan introduces or changes so Codex can review them

If the plan introduces student-facing Danish strings, include them verbatim in the plan.

Keep the plan surgical:
- do not propose broad refactors
- do not introduce speculative features
- do not add new libraries or patterns unless clearly justified
- prefer existing project conventions and helpers
- keep every planned file touch traceable to the user's request

If the task cannot be planned safely without a user decision, write the partial plan with the blocking question clearly marked under "Open questions" and stop.

End by telling the user where the plan was written and that it is ready for Codex plan review.
