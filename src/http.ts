export type HtmlFetcher = (url: string) => Promise<string>;

interface HttpOptions {
  request?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

export function createHtmlFetcher({
  request = fetch,
  timeoutMs = 10_000,
  retries = 2,
  retryDelayMs = 250,
}: HttpOptions = {}): HtmlFetcher {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    !Number.isInteger(retries) ||
    retries < 0 ||
    !Number.isInteger(retryDelayMs) ||
    retryDelayMs < 0
  ) {
    throw new Error(
      'HTTP timeout, retries and retry delay must be valid integers.',
    );
  }

  return async (url) => {
    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await request(url, {
          signal: controller.signal,
          // Reject redirects rather than fetching outside the catalogue scope.
          redirect: 'manual',
          headers: {
            Accept: 'text/html',
            'User-Agent': 'e-commerce-scraper/0.1',
          },
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new HttpStatusError(response.status);
        }
        const contentType = response.headers
          .get('content-type')
          ?.split(';')[0]
          ?.trim();
        if (
          contentType !== 'text/html' &&
          contentType !== 'application/xhtml+xml'
        ) {
          await response.body?.cancel();
          throw new Error(
            `Expected HTML, received ${contentType ?? 'no content type'}`,
          );
        }
        const html = await response.text();
        if (!html.trim()) throw new Error('Empty HTML response');
        return html;
      } catch (error: unknown) {
        const retryable =
          controller.signal.aborted ||
          error instanceof TypeError ||
          (error instanceof HttpStatusError &&
            transientStatuses.has(error.status));
        if (!retryable || attempt >= retries) {
          const message = controller.signal.aborted
            ? `timed out after ${timeoutMs}ms`
            : error instanceof Error
              ? error.message
              : 'unknown request failure';
          throw new Error(
            `Failed to fetch ${url} after ${attempt + 1} attempt(s): ${message}`,
            { cause: error },
          );
        }
      } finally {
        clearTimeout(timer);
      }
      await new Promise<void>((resolve) =>
        setTimeout(resolve, retryDelayMs * 2 ** attempt),
      );
    }
  };
}
