See [AGENTS.md](./AGENTS.md) for how this repository is structured, how to verify a
change, and the traps to avoid.

Machine-readable companions:

- [docs/CAPABILITIES.md](./docs/CAPABILITIES.md) and `docs/capabilities.json` — every
  step an action can be composed from. Generated; run `yarn gen` after changing
  `constants/stepCatalogue.ts`.
- [config.schema.json](./config.schema.json) — JSON Schema for
  `constants/config.json`. Generated from `constants/config.schema.ts`.
