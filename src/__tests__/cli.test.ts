import { spawnSync } from 'node:child_process';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const cli = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const preload = fileURLToPath(
  new URL('./support/fixture-fetch.mjs', import.meta.url),
);
function runCli(args: string[] = [], scenario = 'no-network', stdout?: number) {
  const result = spawnSync(
    process.execPath,
    ['--import', preload, cli, ...args],
    {
      encoding: 'utf8',
      cwd: tmpdir(),
      timeout: 10_000,
      env: { ...process.env, SCRAPER_TEST_SCENARIO: scenario },
      ...(stdout !== undefined
        ? { stdio: ['ignore', stdout, 'pipe'] as const }
        : {}),
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return result;
}

const colors = ['gold', 'white', 'black'];
const expected = {
  results: [
    {
      name: 'Samsung Galaxy',
      description: '5 mpx. Android 5.0',
      price: 93.99,
      colors,
    },
    {
      name: 'Lenovo IdeaTab 128 GB',
      description: '7" screen, Android',
      price: 69.99,
      colors,
    },
    {
      name: 'Lenovo IdeaTab 256 GB',
      description: '7" screen, Android',
      price: 89.99,
      colors,
    },
    {
      name: 'Lenovo IdeaTab 512 GB',
      description: '7" screen, Android',
      price: 109.99,
      colors,
    },
    {
      name: 'Dell Latitude 5480 128 GB',
      description:
        'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
      price: 1310.39,
    },
    {
      name: 'Dell Latitude 5480 256 GB',
      description:
        'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
      price: 1330.39,
    },
    {
      name: 'Dell Latitude 5480 512 GB',
      description:
        'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
      price: 1350.39,
    },
    { name: 'Iphone', description: 'White', price: 899.99, colors },
    { name: 'Iphone', description: 'White', price: 899.99, colors },
    { name: 'Iphone', description: 'White', price: 899.99, colors },
  ],
  total: 7055.1,
};

describe('built CLI end-to-end contract', () => {
  it.each(['--help', '-h'])('prints help for %s without fetching', (flag) => {
    const result = runCli([flag]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: node dist/cli.js [options]');
    expect(result.stdout).toContain('--help');
    expect(result.stdout).toContain('--version');
    expect(result.stdout).toContain('node dist/cli.js > results.json');
  });
  it.each(['--version', '-V'])(
    'prints the version for %s without fetching',
    (flag) => {
      const result = runCli([flag]);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toBe('0.1.0\n');
    },
  );
  it.each([
    ['--unknown', "unknown option '--unknown'"],
    ['unexpected', 'too many arguments'],
  ])('rejects unsupported input %s', (argument, message) => {
    const result = runCli([argument]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain('Usage:');
  });
  it('traverses, parses and aggregates into exactly one JSON object', () => {
    const result = runCli([], 'success');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expected);
  });
  it('redirects stdout to a file without package-manager or terminal output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-cli-'));
    const filename = join(directory, 'results.json');
    const descriptor = openSync(filename, 'w');
    try {
      const result = runCli([], 'success', descriptor);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(readFileSync(filename, 'utf8'))).toEqual(expected);
    } finally {
      closeSync(descriptor);
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it.each([
    ['retrieval-failure', 'HTTP 404'],
    ['parse-failure', 'description'],
  ])('fails %s without partial JSON', (scenario, message) => {
    const result = runCli([], scenario);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Scrape failed:');
    expect(result.stderr).toContain('/product/136');
    expect(result.stderr).toContain(message);
  });
});
