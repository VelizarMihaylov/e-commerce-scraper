import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { prepareOutput, writeOutput } from '../output.js';

it('preserves a file created after the output preflight and cleans staging files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scraper-race-'));
  try {
    const path = await prepareOutput(join(directory, 'results.json'));
    await writeFile(path, 'Created by another process');
    await expect(
      writeOutput(path, '{}', new AbortController().signal),
    ).rejects.toThrow('File already exists');
    expect(await readFile(path, 'utf8')).toBe('Created by another process');
    expect(await readdir(directory)).toEqual(['results.json']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
