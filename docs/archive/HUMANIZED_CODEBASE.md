> **Archived, not current.** Written during the build and kept for history. Several statements here are out of date. See [docs/STATUS.md](../STATUS.md) for what is true now.

# GoalGrid codebase cleanup

This pass keeps the existing product behavior and focuses on making the code easier for a person to read, review and maintain.

## What changed

- Expanded heavily compressed TS/TSX files into normal modules with readable control flow.
- Replaced one-letter local variables with names that describe the domain value they hold.
- Moved repeated UI actions into small, named functions instead of large inline handlers.
- Replaced comments that pointed back to README section numbers with comments that explain intent and trade-offs.
- Reduced unnecessary inline error handling noise and made user-facing messages sound like product copy rather than internal logs.
- Tightened a few types in the LLM response extraction layer.
- Removed unused helpers from the simulation player.
- Kept simulation, prediction, community and security behavior intact.

## What this does not claim

Human-readable code is not the same thing as code that can never have originated with an AI assistant. The goal here is maintainability: a developer should be able to follow the code without decoding compressed generated-looking expressions first.
