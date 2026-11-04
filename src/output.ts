import { constants } from 'node:fs';
import { access, link, lstat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

function fileError(filename: string, error: unknown): Error {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? error.code
      : undefined;
  const hint =
    code === 'EEXIST'
      ? 'File already exists. Choose another path or remove the existing file.'
      : code === 'ENOENT'
        ? 'The destination directory does not exist.'
        : code === 'EACCES' || code === 'EPERM'
          ? 'Check that you have permission to write to this directory.'
          : error instanceof Error
            ? error.message
            : 'Unknown file error';
  return new Error(`Cannot write ${filename}: ${hint}`, { cause: error });
}

export async function prepareOutput(filename: string): Promise<string> {
  const path = resolve(filename);
  try {
    try {
      await lstat(path);
      throw Object.assign(new Error('File exists'), { code: 'EEXIST' });
    } catch (error: unknown) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
    }
    await access(dirname(path), constants.W_OK);
    return path;
  } catch (error: unknown) {
    throw fileError(path, error);
  }
}

export async function writeOutput(
  filename: string,
  json: string,
  signal: AbortSignal,
): Promise<void> {
  let temporary: string | undefined;
  try {
    signal.throwIfAborted();
    temporary = await mkdtemp(join(dirname(filename), '.scraper-'));
    const stagingFile = join(temporary, 'results.json');
    await writeFile(stagingFile, json, { signal });
    signal.throwIfAborted();
    // Publish the complete file atomically; link fails if the destination now exists.
    await link(stagingFile, filename);
  } catch (error: unknown) {
    throw fileError(filename, error);
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
  }
}
