# Agent guidance

This repository is a standalone TypeScript CLI for the e-commerce scraper assessment. Read `README.md` and `package.json` before changing it; the README records implemented behaviour and remaining work.

## Working style

- Work on one requested issue or focused change at a time. Explain meaningful choices and trade-offs briefly before implementing them.
- Keep the assessment's 1–2 hour implementation budget in mind. Record unfinished work and limitations honestly; do not invent elapsed time or a development history.
- Keep the project a standalone CLI with dependencies appropriate to the assessment.
- Preserve unrelated changes. Keep commits small and meaningful when committing is in scope; do not manufacture earlier stages by rewriting completed work.
- Treat suggestions and technology discussions as discussions until implementation is requested. Adding these instructions does not authorize publishing or implementing the rest of the assessment.

## Code conventions

- Use strict TypeScript, ESM, named exports and explicit `.js` extensions for relative runtime imports. Infer types from existing Zod schemas where appropriate.
- Keep argument handling, terminal presentation and process exit behaviour at the CLI boundary. Keep fetching separate from pure parsing, configuration expansion and aggregation.
- Successful scraping writes one JSON object to stdout. Diagnostics and optional progress go to stderr. Help/version are separate informational modes.
- Keep normal execution usable in scripts without prompts. If interactive feedback is added, handle non-interactive terminals and cancellation deliberately.
- Identify unique products by product/configuration identity, not by price. Sum money in integer cents and convert at the JSON boundary. Required missing data or incomplete retrieval must not look like a successful complete scrape.
- Add abstractions and dependencies for current requirements. Keep proposed tools distinct from installed and implemented ones.

## Repository skills

Read only the skill relevant to the current task:

- [Node and pnpm](.agents/skills/node-tooling/SKILL.md): selecting the pinned runtime and running package commands.
- [TypeScript testing](.agents/skills/typescript-testing/SKILL.md): deterministic Vitest tests and CLI contract verification.
- [Branch management](.agents/skills/branch-management/SKILL.md): issue-based branch names and switching to existing ticket branches.
- [Repository workflow](.agents/skills/repository-workflow/SKILL.md): GitHub issues, commits, project status and pull requests.

These skills define this repository's workflow. Treat the user's current instructions as authoritative when they refine the workflow.
