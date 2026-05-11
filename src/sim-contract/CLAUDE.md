# Sim contract

This module is the framework ↔ sim boundary (see "Three seams" in the root `CLAUDE.md`).

**Do not extend `index.ts` without discussion** — every sim depends on its shape, and growing the contract erodes the isolation that lets sims be developed and tested independently.
