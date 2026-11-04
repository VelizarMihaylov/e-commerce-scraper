import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { afterEach, expect, it, vi } from 'vitest';
import { createProgressReporter } from '../progress.js';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it('renders actual progress counts and restores the terminal on completion', () => {
  vi.stubEnv('CI', '');
  vi.stubEnv('TERM', 'xterm');
  vi.useFakeTimers();
  const output = Object.assign(new PassThrough(), {
    isTTY: true,
    columns: 100,
  });
  let text = '';
  output.setEncoding('utf8').on('data', (chunk: string) => {
    text += chunk;
  });
  const reporter = createProgressReporter({ output, onCancel: vi.fn() });
  try {
    reporter.update({ phase: 'discovery', completed: 4 });
    vi.advanceTimersByTime(160);
    reporter.update({ phase: 'products', completed: 2, total: 6 });
    vi.advanceTimersByTime(160);
    reporter.update({ phase: 'processing', total: 6 });
    vi.advanceTimersByTime(160);
    reporter.complete('10 results');
    const plain = stripVTControlCharacters(text);
    expect(plain).toContain('4 listing pages visited');
    expect(plain).toContain('2/6');
    expect(plain).toContain('Processing configurations from 6 products');
    expect(plain).toContain('10 results');
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    reporter.fail('Test cleanup');
    output.destroy();
  }
});
