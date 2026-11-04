import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scrapeResultSchema } from '../dist/product.js';

const directory = new URL('../artifacts/live/', import.meta.url);
mkdirSync(directory, { recursive: true });
const started = Date.now();
const run = spawnSync(
  process.execPath,
  [fileURLToPath(new URL('../dist/cli.js', import.meta.url))],
  {
    encoding: 'utf8',
    timeout: 120_000,
    killSignal: 'SIGKILL',
    maxBuffer: 8 * 1024 * 1024,
  },
);
// Retain raw streams even on failure, including timeout diagnostics.
writeFileSync(new URL('results.json', directory), run.stdout ?? '');
writeFileSync(
  new URL('stderr.log', directory),
  (run.stderr ?? '') + (run.error ? `\n${run.error.message}\n` : ''),
);
try {
  assert.ifError(run.error);
  assert.equal(run.status, 0, 'CLI must exit successfully');
  assert.equal(run.stderr, '', 'Unexpected diagnostics on a successful scrape');
  const output = scrapeResultSchema.parse(JSON.parse(run.stdout));
  assert.ok(output.results.length > 0, 'Empty catalogue');
  let sum = 0;
  for (const product of output.results) {
    const cents = Math.round(product.price * 100);
    assert.ok(
      Number.isSafeInteger(cents) &&
        Math.abs(cents - product.price * 100) < 1e-7,
      'Invalid monetary precision',
    );
    sum += cents;
    if (product.colors) {
      assert.equal(
        new Set(product.colors).size,
        product.colors.length,
        'Duplicate colours',
      );
      assert.ok(
        product.colors.every((color) => color === color.trim().toLowerCase()),
        'Non-normalized colours',
      );
    }
  }
  assert.ok(Number.isSafeInteger(sum), 'Unsafe monetary total');
  assert.equal(output.total, sum / 100, 'Total does not match results');
  const configured = output.results.filter((product) =>
    / \d+ GB$/.test(product.name),
  ).length;
  const withColors = output.results.filter((product) => product.colors).length;
  assert.ok(
    configured > 0 && withColors > 0,
    'Expected storage and colour coverage',
  );
  const summary = {
    checkedAt: new Date().toISOString(),
    elapsedSeconds: (Date.now() - started) / 1000,
    results: output.results.length,
    configuredResults: configured,
    resultsWithColors: withColors,
    total: output.total,
  };
  writeFileSync(
    new URL('summary.json', directory),
    JSON.stringify(summary, null, 2) + '\n',
  );
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  writeFileSync(
    new URL('summary.json', directory),
    JSON.stringify({ failed: true, message: String(error) }, null, 2) + '\n',
  );
  throw error;
}
