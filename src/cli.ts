#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { z } from 'zod';
import { prepareOutput, writeOutput } from './output.js';
import { createProgressReporter } from './progress.js';
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
    .name('e-commerce-scraper')
    .description(
      'Collect products and storage configurations from the Web Scraper test site.',
    )
    .version(version)
    .showHelpAfterError(
      '(Run e-commerce-scraper --help for usage and examples.)',
    )
    .addHelpText('before', 'E-commerce Scraper\n')
    .addHelpText(
      'after',
      `
Examples:
  e-commerce-scraper scrape --output results.json
  e-commerce-scraper scrape > results.json
  e-commerce-scraper scrape --quiet > results.json

Run "e-commerce-scraper scrape --help" for scraping options.
Without installation, use "node dist/cli.js" in place of "e-commerce-scraper".`,
    );

  program
    .command('scrape')
    .description(`Fetch the complete catalogue from ${TARGET_URL}`)
    .option(
      '-o, --output <file>',
      'save JSON to a new file (existing files are preserved)',
    )
    .option(
      '-q, --quiet',
      'suppress progress and completion messages; errors remain visible',
    )
    .addHelpText(
      'after',
      '\nJSON goes to stdout unless --output is supplied. Progress and errors go to stderr.\nPress Ctrl+C to cancel. No prompts are required.',
    )
    .action(async (options: { output?: string; quiet?: boolean }) => {
      const controller = new AbortController();
      let exitCode = 130;
      const cancel = () => controller.abort();
      const terminate = () => {
        exitCode = 143;
        cancel();
      };
      process.on('SIGINT', cancel);
      process.on('SIGTERM', terminate);
      const progress = createProgressReporter({
        quiet: options.quiet ?? false,
        onCancel: cancel,
      });
      try {
        const destination =
          options.output !== undefined
            ? await prepareOutput(options.output)
            : undefined;
        controller.signal.throwIfAborted();
        const result = scrapeResultSchema.parse(
          await scrape({
            signal: controller.signal,
            onProgress: (event) => progress.update(event),
          }),
        );
        controller.signal.throwIfAborted();
        const json = `${JSON.stringify(result, null, 2)}\n`;
        if (destination)
          await writeOutput(destination, json, controller.signal);
        else process.stdout.write(json);
        progress.complete(
          `${result.results.length} results · Total: $${result.total.toFixed(2)}\n${destination ? `Saved to ${destination}` : 'JSON written to stdout.'}`,
        );
      } catch (error: unknown) {
        const cancelled = controller.signal.aborted;
        const message = cancelled
          ? 'Cancelled. No results were written.'
          : `Scrape failed: ${error instanceof Error ? error.message : 'Unexpected failure'}`;
        progress.fail(message, cancelled);
        process.exitCode = cancelled ? exitCode : 1;
        controller.abort();
      } finally {
        process.removeListener('SIGINT', cancel);
        process.removeListener('SIGTERM', terminate);
      }
    });
  if (process.argv.length === 2) program.outputHelp();
  else await program.parseAsync(process.argv);
} catch (error: unknown) {
  process.stderr.write(
    `Scrape failed: ${error instanceof Error ? error.message : 'Unexpected failure'}\n`,
  );
  process.exitCode = 1;
}
