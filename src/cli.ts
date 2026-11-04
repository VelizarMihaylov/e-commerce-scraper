import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { z } from 'zod';
import { scrapeResultSchema } from './product.js';
import { scrape, TARGET_URL } from './scrape.js';

try {
  const { version } = z
    .object({ version: z.string() })
    .parse(
      JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
      ),
    );

  const program = new Command()
    .name('node dist/cli.js')
    .description(`Scrape products from ${TARGET_URL}.`)
    .version(version)
    .showHelpAfterError()
    .addHelpText(
      'after',
      `
Successful runs write one JSON object to stdout; errors go to stderr.
Save results: node dist/cli.js > results.json

Status: scaffold only; scraping is not implemented yet.`,
    )
    .action(async () => {
      const result = scrapeResultSchema.parse(await scrape());
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    });

  await program.parseAsync(process.argv);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected failure';
  process.stderr.write(`Scrape failed: ${message}\n`);
  process.exitCode = 1;
}
