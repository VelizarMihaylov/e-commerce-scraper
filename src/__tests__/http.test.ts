import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHtmlFetcher } from '../http.js';
import { TARGET_URL } from '../site.js';

const htmlResponse = (body = '<p>Product</p>') =>
  new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });

afterEach(() => {
  vi.useRealTimers();
});

describe('HTML retrieval', () => {
  it('returns HTML with a timeout signal and redirects disabled', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(htmlResponse());
    expect(await createHtmlFetcher({ request })(TARGET_URL)).toBe(
      '<p>Product</p>',
    );
    expect(request).toHaveBeenCalledWith(
      TARGET_URL,
      expect.objectContaining({
        redirect: 'manual',
      }),
    );
    expect(request.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([408, 429, 500, 502, 503, 504])(
    'retries transient HTTP %s then succeeds',
    async (status) => {
      vi.useFakeTimers();
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('Temporary failure', { status }))
        .mockResolvedValueOnce(htmlResponse());
      const result = createHtmlFetcher({ request })(TARGET_URL);
      const assertion = expect(result).resolves.toBe('<p>Product</p>');
      await vi.runAllTimersAsync();
      await assertion;
      expect(request).toHaveBeenCalledTimes(2);
    },
  );

  it('stops transient retries after three attempts with the failed URL', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(new Response('Unavailable', { status: 503 })),
      );
    const assertion = expect(
      createHtmlFetcher({ request })(TARGET_URL),
    ).rejects.toThrow(
      `Failed to fetch ${TARGET_URL} after 3 attempt(s): HTTP 503`,
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('retries a network failure without waiting in real time', async () => {
    vi.useFakeTimers();
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(htmlResponse());
    const assertion = expect(
      createHtmlFetcher({ request })(TARGET_URL),
    ).resolves.toContain('Product');
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([301, 302, 400, 401, 403, 404])(
    'does not retry or follow HTTP %s',
    async (status) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('', {
          status,
          headers: { Location: 'https://example.com' },
        }),
      );
      await expect(createHtmlFetcher({ request })(TARGET_URL)).rejects.toThrow(
        `HTTP ${status}`,
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('aborts stalled requests, retries within the limit and reports the timeout', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const assertion = expect(
      createHtmlFetcher({ request, timeoutMs: 100 })(TARGET_URL),
    ).rejects.toThrow(
      `Failed to fetch ${TARGET_URL} after 3 attempt(s): timed out after 100ms`,
    );
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the timeout active while reading the response body', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation((_url, options) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              options?.signal?.addEventListener(
                'abort',
                () =>
                  controller.error(new DOMException('Aborted', 'AbortError')),
                { once: true },
              );
            },
          }),
          { headers: { 'content-type': 'text/html' } },
        ),
      ),
    );
    const assertion = expect(
      createHtmlFetcher({ request, timeoutMs: 100, retries: 0 })(TARGET_URL),
    ).rejects.toThrow('timed out after 100ms');
    await vi.runAllTimersAsync();
    await assertion;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    () =>
      new Response('{"error":"unavailable"}', {
        headers: { 'content-type': 'application/json' },
      }),
    () => htmlResponse('   '),
  ])('rejects invalid responses without retrying', async (response) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response());
    await expect(createHtmlFetcher({ request })(TARGET_URL)).rejects.toThrow(
      TARGET_URL,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
});
