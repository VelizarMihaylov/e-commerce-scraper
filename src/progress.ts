import { intro, outro, spinner } from '@clack/prompts';
import type { Writable } from 'node:stream';
import type { ScrapeProgress } from './scrape.js';

export function createProgressReporter({
  quiet = false,
  output = process.stderr,
  onCancel,
}: {
  quiet?: boolean;
  output?: Writable & { isTTY?: boolean };
  onCancel: () => void;
}) {
  const interactive =
    !quiet && !!output.isTTY && !process.env.CI && process.env.TERM !== 'dumb';
  const spin = interactive
    ? spinner({
        output,
        onCancel,
        cancelMessage: 'Cancelled. No results were written.',
      })
    : undefined;
  function start(message: string) {
    spin?.start(message);
    // Clack's input blocker uses raw-mode Ctrl+C -> exit(0). We have no
    // prompts: retain terminal SIGINT so the CLI can abort work and exit 130.
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  }
  let phase: ScrapeProgress['phase'] | undefined;
  if (spin) {
    intro('E-commerce Scraper', { output });
    start('Discovering catalogue');
  }
  return {
    update(event: ScrapeProgress) {
      if (!spin) return;
      const message =
        event.phase === 'discovery'
          ? `Discovering catalogue — ${event.completed} listing pages visited`
          : event.phase === 'products'
            ? `Fetching product pages — ${event.completed}/${event.total}`
            : `Processing configurations from ${event.total} products`;
      if (phase && phase !== event.phase) {
        spin.stop(
          phase === 'discovery'
            ? 'Catalogue discovered'
            : 'Product pages fetched',
        );
        start(message);
      } else spin.message(message);
      phase = event.phase;
    },
    complete(message: string) {
      if (!spin) return;
      spin.stop('Scrape complete');
      outro(message, { output });
    },
    fail(message: string, cancelled = false) {
      if (spin) {
        if (cancelled) {
          if (!spin.isCancelled) spin.cancel(message);
        } else spin.error(message);
      } else output.write(`${message}\n`);
    },
  };
}
