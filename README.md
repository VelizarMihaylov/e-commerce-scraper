# E-commerce scraper

A standalone TypeScript CLI for the [Web Scraper e-commerce test site](https://webscraper.io/test-sites/e-commerce/static).

## Setup

Requirements: Node.js as specified in `.nvmrc`, and pnpm 10.25.0.

We recommend **NVM (Node Version Manager)** to install and switch between Node.js versions. It lets developers use the version pinned in `.nvmrc`, keeping local development consistent with CI without replacing the system-wide Node.js installation.

If you do not have NVM, follow the [official installation instructions](https://github.com/nvm-sh/nvm#installing-and-updating). On macOS, Linux or Windows via WSL, install it with:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
```

Open a new terminal after installation and run `command -v nvm` to confirm it is available. From the project directory, `nvm install` installs and selects the version in `.nvmrc`; use `nvm use` when returning to the project in a new shell.

```bash
cd e-commerce-scraper
nvm install
nvm use
npm install --global pnpm@10.25.0
pnpm install --frozen-lockfile
pnpm check
node dist/cli.js --help
```

This repository has its own package manifest, lockfile and configurations. GitHub Actions runs the same checks for pull requests and pushes to `main`. Install the recommended ESLint and Prettier VS Code extensions to enable editor diagnostics and formatting.

## Commands

| Command             | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `pnpm dev --help`   | Run CLI help from TypeScript                    |
| `pnpm build`        | Compile the CLI into `dist/`                    |
| `pnpm start`        | Run the compiled CLI                            |
| `pnpm check-types`  | Type-check source and tests                     |
| `pnpm lint`         | Run ESLint, including type-aware checks         |
| `pnpm format`       | Format source and configuration                 |
| `pnpm format:check` | Check formatting without changes                |
| `pnpm test`         | Run deterministic unit tests                    |
| `pnpm test:watch`   | Run tests in watch mode                         |
| `pnpm check`        | Check formatting, lint, types, tests, and build |

The CLI uses Commander for generated help and consistent argument errors. Run `node dist/cli.js --help` for usage or `node dist/cli.js --version` for the package version. Unsupported options and positional arguments exit with code 1.

Catalogue retrieval, product extraction and aggregation are implemented as internal modules. CLI integration is still pending: normal CLI execution exits with code 1, explains the limitation on stderr and emits no JSON.

Once scraping is implemented, capture JSON directly from the built entry point to avoid package-manager output:

```bash
node dist/cli.js > results.json
```

## Structure and conventions

- `src/cli.ts`: argument handling, JSON output, stderr diagnostics, exit status.
- `src/scrape.ts`: scraping entry point; currently an explicit unimplemented failure.
- `src/catalogue.ts`: category/pagination discovery and collection of unique product detail pages.
- `src/http.ts`: HTML retrieval with request timeouts and bounded transient retries.
- `src/site.ts`: catalogue URL scope and canonicalization.
- `src/parse.ts`: pure detail-page extraction and enabled storage configuration expansion.
- `src/aggregate.ts`: deduplication, integer-cent totals and output validation.
- `src/product.ts`: Zod output schemas and inferred TypeScript types.
- `src/__tests__/`: neighbouring Vitest tests with explicit expected outcomes.

Keep external operations separate from pure parsing and aggregation. Use strict TypeScript, ESM, named exports, and explicit `.js` import extensions for compiled Node execution. Mock network boundaries in unit tests; keep live verification separate.

## Catalogue retrieval

`collectProductPages()` follows category navigation and actual Next links, including pages omitted from the numbered pagination controls. It stays within the target catalogue, normalizes page-one aliases and removes duplicate product URLs. Each returned item retains its canonical `url` and detail-page `html` for later extraction.

Listing discovery is sequential; product details are fetched in batches of three, preserving discovery order. HTTP requests have a 10-second timeout covering the response body and at most two retries for network failures, timeouts and transient HTTP statuses (408, 429, 500, 502, 503, 504), with 250ms then 500ms delays. Redirects, non-HTML responses and unexpected page structures fail explicitly. Any failed page rejects the collection rather than returning partial results.

A live traversal check on 4 November 2026 retrieved **29 listing pages and 147 unique product pages** in approximately **12.4 seconds**, with no duplicate requests and a maximum of three concurrent requests. These are observed counts, not hardcoded targets. This validates discovery and retrieval; configuration prices, totals and the complete CLI still need verification. Unit tests use captured fixtures and controlled responses without accessing the live site.

## Product extraction and totals

`parseProductPage({ url, html })` returns products with canonical URL/configuration identity and prices in integer cents. It preserves full detail titles and descriptions, expands enabled storage options, and includes normalized colours only when at least two distinct available values remain. Missing required fields, malformed prices, unknown enabled storage values and an unexpected initial configuration fail with the product URL.

The site-specific storage modifiers are documented in the [investigation](docs/catalogue-investigation.md): 128/256/512/1024 GB add $0/$20/$40/$60 to the initial 128 GB price. Disabled options are excluded; colours do not multiply configurations. This rule is based on the site's observed JavaScript and must be spot-checked against live prices before submission in #6.

`aggregateProducts()` deduplicates canonical URL plus storage identity, sums cents, and returns only `{ results, total }` with numeric dollar prices. Separate products sharing a name or price remain separate. Captured phone, tablet and laptop fixtures produce seven results totalling $4,355.13, unchanged when the inputs are repeated.

Run the extraction checks locally with:

```bash
pnpm exec vitest run src/__tests__/parse.test.ts src/__tests__/aggregate.test.ts
```

These checks use captured HTML plus explicitly labelled synthetic fixtures for no-control and single-colour products. They do not call the live site. The normal CLI command still reports the unimplemented integration until #6 connects these modules.

## Remaining assessment work

- [x] Inspect category navigation, pagination, configuration prices, and colour options. See the [catalogue investigation](docs/catalogue-investigation.md) and its fixture manifest.
- [x] Traverse the complete catalogue within the target site and deduplicate products.
- [x] Extract full names, descriptions, and prices from product detail pages.
- [x] Expand each HDD option into a separate product with its actual price and configuration name.
- [x] Include `colors` only when multiple distinct options exist.
- [x] Parse and sum prices in integer cents; convert to JSON numbers at the output boundary.
- [x] Add request timeouts, bounded transient retries, and modest concurrency.
- [x] Fail clearly on incomplete retrieval or unexpected page structure.
- [x] Fail clearly on missing required product data.
- [x] Test fixtures, pagination, duplicates, configurations and exact totals.
- [ ] Connect the CLI and verify successful output and failure behaviour end to end.
- [ ] Perform a live smoke test and document results, elapsed work time, and trade-offs.

Interpretation: `total` sums each unique product/configuration once. Different products with the same price both contribute. Aggregation validates the output schema and calculates `total` from the unique results in integer cents.

## AI-assisted development

Repository working rules live in [AGENTS.md](AGENTS.md), with focused skills under `.agents/skills/` for Node/pnpm, TypeScript testing, branch management and GitHub delivery. These define the development conventions for this CLI. Read the applicable skill when working in that area.
