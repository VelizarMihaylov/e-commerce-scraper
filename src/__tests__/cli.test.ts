import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  writeFileSync,
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
    expect(result.stdout).toContain(
      'Usage: e-commerce-scraper [options] [command]',
    );
    expect(result.stdout).toContain('--help');
    expect(result.stdout).toContain('--version');
    expect(result.stdout).toContain('e-commerce-scraper scrape > results.json');
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
    ['unexpected', "unknown command 'unexpected'"],
  ])('rejects unsupported input %s', (argument, message) => {
    const result = runCli([argument]);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(message);
    expect(result.stderr).toContain('--help');
  });
  it('traverses, parses and aggregates into exactly one JSON object', () => {
    const result = runCli(['scrape'], 'success');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expected);
  });
  it('redirects stdout to a file without package-manager or terminal output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-cli-'));
    const filename = join(directory, 'results.json');
    const descriptor = openSync(filename, 'w');
    try {
      const result = runCli(['scrape'], 'success', descriptor);
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
    const result = runCli(['scrape'], scenario);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Scrape failed:');
    expect(result.stderr).toContain('/product/136');
    expect(result.stderr).toContain(message);
  });
  it('shows a helpful starting screen without fetching', () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('E-commerce Scraper');
    expect(result.stdout).toContain('scrape --output results.json');
  });
  it('explains scrape options without fetching', () => {
    const result = runCli(['scrape', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--output <file>');
    expect(result.stdout).toContain('--quiet');
    expect(result.stdout).toContain('Ctrl+C');
    expect(result.stderr).toBe('');
  });
  it('rejects a missing output argument and suggests help', () => {
    const result = runCli(['scrape', '--output']);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('argument missing');
    expect(result.stderr).toContain('--help');
  });
  it('saves complete JSON to --output and leaves stdout empty', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-output-'));
    const filename = join(directory, 'results with spaces.json');
    try {
      const result = runCli(['scrape', '--output', filename], 'success');
      expect(result.status).toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(JSON.parse(readFileSync(filename, 'utf8'))).toEqual(expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('preserves an existing output file and fails before fetching', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-output-'));
    const filename = join(directory, 'results.json');
    writeFileSync(filename, 'Existing work');
    try {
      const result = runCli(['scrape', '--output', filename]);
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('File already exists');
      expect(result.stderr).not.toContain('Unexpected network');
      expect(readFileSync(filename, 'utf8')).toBe('Existing work');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('explains an unavailable destination before fetching', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-output-'));
    try {
      const result = runCli([
        'scrape',
        '--output',
        join(directory, 'missing', 'results.json'),
      ]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('directory does not exist');
      expect(result.stdout).toBe('');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('does not create an output file on a failed scrape', () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-output-'));
    const filename = join(directory, 'results.json');
    try {
      const result = runCli(['scrape', '-o', filename], 'parse-failure');
      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(existsSync(filename)).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('keeps terminal feedback on stderr while stdout is JSON', () => {
    const result = runCli(['scrape'], 'interactive');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expected);
    expect(result.stderr).toContain('E-commerce Scraper');
    expect(result.stderr).toContain('10 results');
    expect(result.stderr).toContain('$7055.10');
  });
  it('quiet mode suppresses terminal progress but retains JSON', () => {
    const result = runCli(['scrape', '--quiet'], 'interactive');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual(expected);
  });
  it('quiet mode retains actionable errors', () => {
    const result = runCli(['scrape', '--quiet'], 'retrieval-failure');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('HTTP 404');
    expect(result.stdout).toBe('');
  });
  it('Ctrl+C aborts an active request and does not write an output file', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'scraper-cancel-'));
    const filename = join(directory, 'results.json');
    const child = spawn(
      process.execPath,
      ['--import', preload, cli, 'scrape', '-o', filename],
      {
        env: { ...process.env, SCRAPER_TEST_SCENARIO: 'cancel' },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      },
    );
    if (!child.stdout || !child.stderr)
      throw new Error('Expected piped child output');
    let stdout = '';
    let stderr = '';
    let aborted = false;
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('message', (message) => {
      if (message === 'fetch-started') child.kill('SIGINT');
      if (message === 'fetch-aborted') aborted = true;
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try {
      const code = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(code).toBe(130);
      expect(aborted).toBe(true);
      expect(stdout).toBe('');
      expect(stderr).toContain('Cancelled');
      expect(existsSync(filename)).toBe(false);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill('SIGKILL');
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('runs the executable through its shebang', () => {
    const result = spawnSync(cli, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('0.1.0\n');
  });
});
