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

Scraping is not implemented yet: normal execution exits with code 1, explains the limitation on stderr and emits no JSON.

Once scraping is implemented, capture JSON directly from the built entry point to avoid package-manager output:

```bash
node dist/cli.js > results.json
```

## Structure and conventions

- `src/cli.ts`: argument handling, JSON output, stderr diagnostics, exit status.
- `src/scrape.ts`: scraping entry point; currently an explicit unimplemented failure.
- `src/product.ts`: Zod output schemas and inferred TypeScript types.
- `src/__tests__/`: neighbouring Vitest tests with explicit expected outcomes.

Add `http.ts` and `parse.ts` when implementing network behaviour and site-specific parsing. Keep external operations separate from pure parsing and aggregation. Use strict TypeScript, ESM, named exports, and explicit `.js` import extensions for compiled Node execution. Mock network boundaries in unit tests; keep live verification separate.

## Remaining assessment work

- [x] Inspect category navigation, pagination, configuration prices, and colour options. See the [catalogue investigation](docs/catalogue-investigation.md) and its fixture manifest.
- [ ] Traverse the complete catalogue within the target site and deduplicate products.
- [ ] Extract full names, descriptions, and prices from product detail pages.
- [ ] Expand each HDD option into a separate product with its actual price and configuration name.
- [ ] Include `colors` only when multiple distinct options exist.
- [ ] Parse and sum prices in integer cents; convert to JSON numbers at the output boundary.
- [ ] Add request timeouts, bounded transient retries, and modest concurrency.
- [ ] Fail clearly on missing data or incomplete retrieval.
- [ ] Test fixtures, pagination, duplicates, configurations, totals, and CLI output/failure behaviour.
- [ ] Perform a live smoke test and document results, elapsed work time, and trade-offs.

Interpretation: `total` sums each unique product/configuration once. Different products with the same price both contribute. The output schema validates shape; monetary aggregation and consistency between `results` and `total` still need implementation and tests.

## AI-assisted development

Repository working rules live in [AGENTS.md](AGENTS.md), with focused skills under `.agents/skills/` for Node/pnpm, TypeScript testing, branch management and GitHub delivery. These define the development conventions for this CLI. Read the applicable skill when working in that area.
