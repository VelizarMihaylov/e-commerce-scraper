import { parseArgs } from 'node:util';
import { scrapeResultSchema } from './product.js';
import { scrape, TARGET_URL } from './scrape.js';

try {
  const { values } = parseArgs({
    options: { help: { type: 'boolean', short: 'h' } },
    allowPositionals: false,
    strict: true,
  });

  if (values.help) {
    process.stdout.write(`Usage: node dist/cli.js [--help]\n
Scrape products from ${TARGET_URL}.
Successful runs write one JSON object to stdout; errors go to stderr.

Options:
  -h, --help  Show this help message

Status: scaffold only; scraping is not implemented yet.
`);
  } else {
    const result = scrapeResultSchema.parse(await scrape());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected failure';
  process.stderr.write(`Scrape failed: ${message}\n`);
  process.exitCode = 1;
}
