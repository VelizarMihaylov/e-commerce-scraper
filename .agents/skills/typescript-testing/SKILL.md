---
name: typescript-testing
description: Add or update deterministic Vitest tests for the scraper's parsing, aggregation, network orchestration and CLI output contracts.
---

# TypeScript testing

- Use Vitest. Place tests in a neighbouring `__tests__` directory and name them `<subject>.test.ts`.
- Test observable behaviour with explicit expected values. Avoid duplicating the production algorithm or asserting incidental internal call order.
- Exercise pure parsing and aggregation directly. Use small representative HTML fixtures and narrow typed fakes for network boundaries; unit tests must not contact the live site.
- Cover the cases relevant to the change: duplicate product links, equal prices on different products, storage-specific names/prices, optional colours, exact monetary totals and malformed or missing required data.
- For fetch orchestration, cover pagination and bounded failure handling when implemented. Control time and network outcomes so retry tests are deterministic.
- Verify CLI stdout, stderr and exit codes when changing command behaviour. Parse successful stdout as a single JSON document; check that failures do not emit success results. Include help and invalid-argument cases when relevant.
- Clear mocks between tests and restore any changed globals or fake timers. Do not load React, DOM or accessibility-test tooling for this CLI.
- Run the affected suite with `pnpm exec vitest run <test-file>` and run `pnpm check-types`. Use the repository's broader checks when the change is ready.
- Keep live-site smoke checks separate from unit tests and report what they actually establish. Documentation changes do not require new application tests.
