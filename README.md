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

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `pnpm dev --help`   | Run CLI help from TypeScript                        |
| `pnpm build`        | Compile the CLI into `dist/`                        |
| `pnpm start`        | Show the compiled CLI help                          |
| `pnpm check-types`  | Type-check source and tests                         |
| `pnpm lint`         | Run ESLint, including type-aware checks             |
| `pnpm format`       | Format source and configuration                     |
| `pnpm format:check` | Check formatting without changes                    |
| `pnpm test`         | Build and run unit and CLI end-to-end tests         |
| `pnpm test:watch`   | Watch unit tests (excludes compiled CLI tests)      |
| `pnpm smoke:live`   | Build, run live CLI and save verification artifacts |
| `pnpm check`        | Check formatting, lint, types, tests, and build     |

The CLI uses Commander for generated help and consistent argument errors. Run `node dist/cli.js --help` for usage or `node dist/cli.js --version` for the package version. Unknown commands, unsupported options and unexpected arguments exit with code 1 and show a help hint.

Run without arguments to see commands and examples. Use the explicit `scrape` command to fetch products. From this repository:

```bash
pnpm build
pnpm start
pnpm start scrape --output results.json
```

`--output` saves one JSON object containing `results` and `total` to a **new file**. Existing files are preserved, and missing destination directories produce an actionable error. The complete file is staged in the destination directory and published only after the scrape succeeds. Failed or cancelled scrapes do not publish an output file.

For the shorter executable name, optionally link the built local package:

```bash
npm link
e-commerce-scraper
e-commerce-scraper scrape --help
e-commerce-scraper scrape --output results.json
```

The package's `bin` entry exposes `e-commerce-scraper`; the build supplies its Node shebang and executable permissions. Linking uses this checkout, so rebuild after changing TypeScript. Without linking, `node dist/cli.js` supports the same commands and options.

For scripts, omit `--output` and redirect JSON directly from the entry point, avoiding package-manager messages:

```bash
node dist/cli.js scrape > results.json
node dist/cli.js scrape --quiet > results.json
```

Terminal progress uses Clack on **stderr**: discovered listing counts, fetched product counts, processing and a completion summary. It remains visible when stdout is redirected to a file. `--quiet` suppresses progress and completion messages while keeping errors. When stderr is not a terminal, in CI, or with `TERM=dumb`, progress is automatically disabled; no prompts or animations are emitted. Output-file mode leaves stdout empty.

Press **Ctrl+C** to abort requests and retry waits; cancellation exits with code 130 (SIGTERM: 143). Errors go to stderr with exit code 1 and no partial-success JSON. Help/version exit successfully without fetching. The earlier bare invocation that started scraping is replaced by the explicit `scrape` command.

## Structure and conventions

- `src/cli.ts`: argument handling, JSON output, stderr diagnostics, exit status.
- `src/scrape.ts`: connects catalogue retrieval, parsing and aggregation.
- `src/catalogue.ts`: category/pagination discovery and collection of unique product detail pages.
- `src/http.ts`: HTML retrieval with request timeouts and bounded transient retries.
- `src/site.ts`: catalogue URL scope and canonicalization.
- `src/parse.ts`: pure detail-page extraction and enabled storage configuration expansion.
- `src/aggregate.ts`: deduplication, integer-cent totals and output validation.
- `src/progress.ts`: terminal presentation, kept separate from scraping decisions.
- `src/output.ts`: output destination validation and publication without overwriting.
- `src/product.ts`: Zod output schemas and inferred TypeScript types.
- `src/__tests__/`: Vitest unit tests and compiled CLI end-to-end tests.
- `scripts/live-smoke.mjs`: bounded live CLI run and output verification.

Keep external operations separate from pure parsing and aggregation. Use strict TypeScript, ESM, named exports, and explicit `.js` import extensions for compiled Node execution. Mock network boundaries in unit tests; keep live verification separate.

## Catalogue retrieval

`collectProductPages()` follows category navigation and actual Next links, including pages omitted from the numbered pagination controls. It stays within the target catalogue, normalizes page-one aliases and removes duplicate product URLs. Each returned item retains its canonical `url` and detail-page `html` for later extraction.

Listing discovery is sequential; product details are fetched in batches of three, preserving discovery order. HTTP requests have a 10-second timeout covering the response body and at most two retries for network failures, timeouts and transient HTTP statuses (408, 429, 500, 502, 503, 504), with 250ms then 500ms delays. Redirects, non-HTML responses and unexpected page structures fail explicitly. Any failed page rejects the collection rather than returning partial results.

A live traversal check on 4 November 2026 retrieved **29 listing pages and 147 unique product pages** in approximately **12.4 seconds**, with no duplicate requests and a maximum of three concurrent requests. These are observed counts, not hardcoded targets. The complete CLI verification below also checks configuration prices and totals. Unit tests use captured fixtures and controlled responses without accessing the live site.

## Product extraction and totals

`parseProductPage({ url, html })` returns products with canonical URL/configuration identity and prices in integer cents. It preserves full detail titles and source descriptions (apart from whitespace normalization), expands enabled storage options, and includes normalized colours only when at least two distinct available values remain. Missing required fields, malformed prices, unknown enabled storage values and an unexpected initial configuration fail with the product URL.

Descriptions remain the original website text even when they mention a default storage size that differs from the selected configuration. The configuration name and price reflect the selected option; descriptions are not rewritten or used to infer options.

The site-specific storage modifiers are documented in the [investigation](docs/catalogue-investigation.md): 128/256/512/1024 GB add $0/$20/$40/$60 to the initial 128 GB price. Disabled options are excluded; colours do not multiply configurations. This rule is based on the site's observed JavaScript; the independent browser spot-check below confirms representative prices. Recheck it if the site changes.

`aggregateProducts()` deduplicates canonical URL plus storage identity, sums cents, and returns only `{ results, total }` with numeric dollar prices. Separate products sharing a name or price remain separate. Captured phone, tablet and laptop fixtures produce seven results totalling $4,355.13, unchanged when the inputs are repeated.

Run the extraction checks locally with:

```bash
pnpm exec vitest run src/__tests__/parse.test.ts src/__tests__/aggregate.test.ts
```

These checks use captured HTML plus explicitly labelled synthetic fixtures for no-control and single-colour products. They do not call the live site.

## Verification

`pnpm check` runs formatting, lint, type checking, a fresh build and all tests. CLI tests spawn the compiled entry point from a different working directory and preload controlled HTML responses at the fetch boundary. They cover combined storage/colours, repeated links, distinct equal-price products, exact JSON output, redirected stdout, help/version without network calls, retrieval/parsing failures without partial JSON, output-file protection, terminal/quiet output routing and cancellation. Progress and HTTP tests cover actual counts and aborting retry waits. Normal CI runs these deterministic checks on every PR and push to `main`.

For a live check, run `pnpm smoke:live`. It runs the real CLI with a two-minute process limit, validates nonempty output, storage/colour coverage and the monetary total, and writes `results.json`, `stderr.log` and `summary.json` under ignored `artifacts/live/`. HTTP requests retain the normal timeout, retry and concurrency limits. This check does not assert fixed live prices or catalogue counts.

In GitHub Actions, select **Live smoke test → Run workflow** for a manual live check, or use:

```bash
gh workflow run live-smoke.yml --repo VelizarMihaylov/e-commerce-scraper --ref main
```

The separate `live-smoke.yml` workflow runs only when manually triggered; regular CI remains in `ci.yml`. Its output and logs are uploaded as `live-smoke-output` for seven days, including on failure. There is no scheduled workflow. The live check detects retrieval, structure and total-consistency failures; it cannot independently prove that the site's pricing rules have not changed.

### Observed live results

On **4 November 2026**, the compiled CLI completed in **12.8 seconds**, producing **423 results**, of which **414 have storage configurations** and **72 include colours**, with **total 345701.52** and empty stderr. Each of 128/256/512 GB appeared 138 times; disabled 1024 GB appeared zero times. Three separate `Iphone` results were retained. These are observations, not fixed expectations.

Completeness is assessed by following all discovered categories and Next links to their terminal pages, tracking canonical identities and failing on incomplete retrieval. The same day's traversal check reached 29 listing pages and 147 distinct detail URLs; the expanded CLI output is consistent with 138 storage products × 3 options plus 9 phones. Fixture tests cover featured-product overlap, nested navigation and omitted middle-page numbers. This establishes coverage of the reachable catalogue; it is not a claim about products the website does not link.

An independent browser check clicked the actual controls, then compared the displayed prices with the generated CLI JSON:

| Product                                                                                      | 128 GB  | 256 GB  | 512 GB  |
| -------------------------------------------------------------------------------------------- | ------- | ------- | ------- |
| [Dell Latitude 5480, ID 136](https://webscraper.io/test-sites/e-commerce/static/product/136) | 1310.39 | 1330.39 | 1350.39 |
| [Lenovo IdeaTab, ID 10](https://webscraper.io/test-sites/e-commerce/static/product/10)       | 69.99   | 89.99   | 109.99  |

Both pages disabled 1024 GB. Returning the Dell to 128 restored 1310.39; selecting Gold on the tablet left its 512 GB price at 109.99. The CLI preserved the base title and returned `gold`, `white`, `black` on each tablet configuration. These comparisons were made against browser-displayed prices, independently of the parser's modifier map.

### CLI UX verification

The packaged executable was installed into an isolated temporary npm prefix and its version/help commands passed. A real catalogue scrape through `scrape --output` still produced 423 results and total 345701.52. A terminal run with delayed fixture responses displayed discovery and fetch counts, restored the cursor, and saved valid JSON. A stalled terminal run cancelled with Ctrl+C exited 130 without creating its output file. The spinner retains normal terminal input mode so cancellation uses the CLI's abort handler rather than Clack's raw-mode exit behaviour.

## Decisions and limitations

- `total` sums each unique product/configuration once. Different products sharing a price both contribute. All arithmetic uses integer cents until JSON serialization.
- Fetch plus Cheerio is sufficient for this site's HTML. Storage pricing uses a documented site-specific rule rather than executing remote JavaScript or adding a browser dependency. Unknown enabled configurations fail explicitly; a changed modifier for a known configuration requires a fresh browser check.
- Retries handle transient failures; redirects and unexpected page structures fail instead of silently returning incomplete data. No partial catalogue is emitted. A successful run holds detail HTML and results in memory, which is reasonable for this test catalogue.
- The fixture suite controls HTTP responses at the fetch boundary; the separate live check exercises real HTTP. The live smoke script bounds the overall process to two minutes; ordinary CLI runs use per-request timeouts and do not have a global deadline.
- Scheduled website-change monitoring, broader pricing-change detection and streaming for much larger catalogues are deferred. The CLI is non-interactive and script-friendly.
- Work was delivered incrementally with AI assistance. Total hands-on time was not tracked reliably across sessions, so no aggregate duration is claimed. The run times above measure execution, not development time.

## AI-assisted development

Repository working rules live in [AGENTS.md](AGENTS.md), with focused skills under `.agents/skills/` for Node/pnpm, TypeScript testing, branch management and GitHub delivery. These define the development conventions for this CLI. Read the applicable skill when working in that area.
