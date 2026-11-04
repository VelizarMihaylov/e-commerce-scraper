import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function runCli(...args: string[]) {
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      import.meta.resolve('tsx'),
      fileURLToPath(new URL('../cli.ts', import.meta.url)),
      ...args,
    ],
    { encoding: 'utf8', cwd: tmpdir(), timeout: 10_000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

describe('CLI contract', () => {
  it.each(['--help', '-h'])('prints help for %s without scraping', (flag) => {
    const result = runCli(flag);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: node dist/cli.js [options]');
    expect(result.stdout).toContain('--help');
    expect(result.stdout).toContain('--version');
    expect(result.stdout).toContain('node dist/cli.js > results.json');
    expect(result.stdout).toContain('scraping is not implemented yet');
  });

  it.each(['--version', '-V'])('prints the version for %s', (flag) => {
    const result = runCli(flag);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe('0.1.0\n');
  });

  it.each([
    ['--unknown', "unknown option '--unknown'"],
    ['unexpected', 'too many arguments'],
  ])('rejects unsupported input %s', (argument, message) => {
    const result = runCli(argument);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain('Usage:');
  });

  it('reports the unimplemented scraper without producing success JSON', () => {
    const result = runCli();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Scrape failed: Scraping is not implemented yet.\n',
    );
  });
});
