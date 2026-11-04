import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { collectProductPages, discoverCatalogueLinks } from '../catalogue.js';
import { normalizeCatalogueUrl, TARGET_URL } from '../site.js';

const fixture = (name: string) =>
  readFileSync(
    new URL(`./fixtures/catalogue/${name}.html`, import.meta.url),
    'utf8',
  );
const product = (id: number) => `${TARGET_URL}/product/${id}`;
const laptops = `${TARGET_URL}/computers/laptops`;

// Small synthetic listing graph for orchestration, separate from captured HTML.
function listing(products: number[], navigation = '', pagination = ''): string {
  return `<div class="test-site"><ul id="side-menu">${navigation}</ul>
    ${products.map((id) => `<a class="title" href="${product(id)}">Product</a>`).join('')}
    <div id="static-pagination">${pagination}</div></div>`;
}
const category = (url: string) =>
  `<a class="category-link" href="${url}">Category</a>`;
const next = (url: string) => `<a rel="next" href="${url}">Next</a>`;

describe('catalogue discovery', () => {
  it('discovers nested categories and product identities from a captured page', () => {
    const links = discoverCatalogueLinks(
      fixture('computers'),
      `${TARGET_URL}/computers`,
    );
    expect(links.listingUrls).toEqual([
      `${TARGET_URL}/computers`,
      laptops,
      `${TARGET_URL}/computers/tablets`,
      `${TARGET_URL}/phones`,
    ]);
    expect(links.productUrls).toEqual([product(26), product(22), product(127)]);
  });

  it('follows Next rather than assuming the first page lists every page number', () => {
    const links = discoverCatalogueLinks(fixture('laptops-first'), laptops);
    expect(links.listingUrls.filter((url) => url.includes('?'))).toEqual([
      `${laptops}?page=2`,
    ]);
    expect(links.productUrls).toEqual([31, 32, 33, 34, 35, 36].map(product));
  });

  it('stops pagination at a disabled Next and retains equal-name/price products', () => {
    const links = discoverCatalogueLinks(
      fixture('phones-last'),
      `${TARGET_URL}/phones/touch?page=2`,
    );
    expect(links.listingUrls.filter((url) => url.includes('?'))).toEqual([]);
    expect(links.productUrls).toEqual([product(7), product(8), product(9)]);
  });

  it.each([
    ['https://example.com/test-sites/e-commerce/static/product/1', null],
    ['/test-sites/e-commerce/static-other/product/1', null],
    ['/test-sites/e-commerce/ajax/product/1', null],
    ['javascript:alert(1)', null],
    ['http://[', null],
    [`${laptops}?page=0`, null],
    [`${laptops}?page=1#top`, laptops],
    [`${laptops}/?page=2#top`, `${laptops}?page=2`],
    ['/test-sites/e-commerce/static/product/3?tracking=1#reviews', product(3)],
    ['?page=3', `${laptops}?page=3`],
  ])('normalizes or rejects %s', (href, expected) => {
    expect(normalizeCatalogueUrl(href, laptops)).toBe(expected);
  });

  it('rejects error pages and unexpected empty catalogue results', () => {
    expect(() =>
      discoverCatalogueLinks('<h1>Unavailable</h1>', TARGET_URL),
    ).toThrow(TARGET_URL);
    expect(() => discoverCatalogueLinks(listing([]), TARGET_URL)).toThrow(
      'No product links',
    );
  });
});

describe('catalogue traversal', () => {
  function catalogue() {
    return new Map([
      [TARGET_URL, listing([3], category(`${TARGET_URL}/computers`))],
      [`${TARGET_URL}/computers`, listing([3], category(laptops))],
      [
        laptops,
        listing(
          [3, 10],
          category(`${laptops}?page=1#top`),
          `${next(`${laptops}?page=2`)}<a href="${laptops}?page=2">2</a><span>...</span>`,
        ),
      ],
      [
        `${laptops}?page=2`,
        listing([136], category(laptops), next(`${laptops}?page=3`)),
      ],
      [
        `${laptops}?page=3`,
        listing(
          [127],
          '',
          '<span class="next" aria-disabled="true">Next</span>',
        ),
      ],
      [product(3), fixture('phone-colors')],
      [product(10), fixture('tablet-storage-colors')],
      [product(136), fixture('laptop-storage')],
      [product(127), fixture('laptop-long-name')],
    ]);
  }

  it('reaches products beyond featured pages and pagination gaps exactly once', async () => {
    const responses = catalogue();
    responses.set(
      TARGET_URL,
      listing(
        [3],
        category(`${TARGET_URL}/computers`) +
          category('https://example.com/elsewhere'),
      ),
    );
    const fetchHtml = vi.fn((url: string) => {
      const html = responses.get(url);
      return html
        ? Promise.resolve(html)
        : Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    const pages = await collectProductPages({ fetchHtml });
    expect(pages.map(({ url }) => url)).toEqual([3, 10, 136, 127].map(product));
    expect(pages[0]?.html).toBe(fixture('phone-colors'));
    expect(fetchHtml.mock.calls.map(([url]) => url)).toEqual([
      ...responses.keys(),
    ]);
  });

  it('bounds concurrent detail requests and returns stable discovery order', async () => {
    const waiting = new Map<string, (html: string) => void>();
    const fetchHtml = vi.fn((url: string) => {
      if (url === TARGET_URL) return Promise.resolve(listing([3, 10, 136]));
      return new Promise<string>((resolve) => waiting.set(url, resolve));
    });
    const collection = collectProductPages({ fetchHtml, concurrency: 2 });
    await vi.waitFor(() => expect(waiting.size).toBe(2));
    expect(fetchHtml.mock.calls.map(([url]) => url)).toEqual([
      TARGET_URL,
      product(3),
      product(10),
    ]);
    waiting.get(product(10))?.(fixture('tablet-storage-colors'));
    waiting.get(product(3))?.(fixture('phone-colors'));
    await vi.waitFor(() => expect(waiting.has(product(136))).toBe(true));
    waiting.get(product(136))?.(fixture('laptop-storage'));
    expect((await collection).map(({ url }) => url)).toEqual(
      [3, 10, 136].map(product),
    );
  });

  it.each([`${laptops}?page=2`, product(10)])(
    'fails the whole collection when %s cannot be retrieved',
    async (failedUrl) => {
      const responses = catalogue();
      const fetchHtml = vi.fn((url: string) =>
        url === failedUrl
          ? Promise.reject(new Error('Connection lost'))
          : Promise.resolve(responses.get(url) ?? ''),
      );
      await expect(collectProductPages({ fetchHtml })).rejects.toThrow(
        failedUrl,
      );
    },
  );

  it('rejects a successful HTTP response that is not a product detail page', async () => {
    const fetchHtml = vi.fn((url: string) =>
      Promise.resolve(url === TARGET_URL ? listing([3]) : '<h1>Error</h1>'),
    );
    await expect(collectProductPages({ fetchHtml })).rejects.toThrow(
      `Unexpected product page structure at ${product(3)}`,
    );
  });
});
