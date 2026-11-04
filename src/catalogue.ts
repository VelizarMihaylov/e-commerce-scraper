import { load } from 'cheerio';
import { createHtmlFetcher } from './http.js';
import type { HtmlFetcher } from './http.js';
import { isProductUrl, normalizeCatalogueUrl, TARGET_URL } from './site.js';

export interface ProductPage {
  url: string;
  html: string;
}

export type CatalogueProgress =
  | { phase: 'discovery'; completed: number }
  | { phase: 'products'; completed: number; total: number };

interface CatalogueOptions {
  signal?: AbortSignal;
  onProgress?: (event: CatalogueProgress) => void;
  fetchHtml?: HtmlFetcher;
  startUrl?: string;
  concurrency?: number;
}

export function discoverCatalogueLinks(
  html: string,
  pageUrl: string,
  rootUrl = TARGET_URL,
) {
  const $ = load(html);
  if (
    $('.test-site').length !== 1 ||
    $('#side-menu').length !== 1 ||
    $('#static-pagination').length !== 1
  ) {
    throw new Error(`Unexpected catalogue page structure at ${pageUrl}`);
  }
  const listingUrls = new Set<string>();
  const productUrls = new Set<string>();
  for (const element of $(
    '.test-site a.title, #side-menu a.category-link, #side-menu a.subcategory-link, #static-pagination a[rel="next"]',
  )) {
    const link = $(element);
    if (link.closest('[disabled], [aria-disabled="true"], .disabled').length)
      continue;
    const href = link.attr('href');
    if (!href) continue;
    const url = normalizeCatalogueUrl(href, pageUrl, rootUrl);
    if (!url) continue;
    if (isProductUrl(url, rootUrl)) productUrls.add(url);
    else if (!link.hasClass('title')) listingUrls.add(url);
  }
  if (productUrls.size === 0) {
    throw new Error(
      `No product links found at ${pageUrl}; catalogue may have changed`,
    );
  }
  return { listingUrls: [...listingUrls], productUrls: [...productUrls] };
}

export async function collectProductPages({
  signal,
  onProgress,
  fetchHtml = createHtmlFetcher(signal ? { signal } : {}),
  startUrl = TARGET_URL,
  concurrency = 3,
}: CatalogueOptions = {}): Promise<ProductPage[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) {
    throw new Error(
      'Catalogue concurrency must be an integer between 1 and 10.',
    );
  }
  const root = normalizeCatalogueUrl(startUrl, startUrl, startUrl);
  if (!root) throw new Error(`Invalid catalogue URL: ${startUrl}`);
  const queue = [root];
  const visited = new Set(queue);
  const products = new Set<string>();

  async function retrieve(url: string): Promise<string> {
    try {
      return await fetchHtml(url);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'unknown request failure';
      throw new Error(`Could not retrieve ${url}: ${message}`, {
        cause: error,
      });
    }
  }

  let listingsCompleted = 0;
  onProgress?.({ phase: 'discovery', completed: 0 });
  while (queue.length) {
    signal?.throwIfAborted();
    const url = queue.shift();
    if (!url) break;
    const html = await retrieve(url);
    const links = discoverCatalogueLinks(html, url, root);
    for (const listing of links.listingUrls) {
      if (!visited.has(listing)) {
        visited.add(listing);
        queue.push(listing);
      }
    }
    for (const product of links.productUrls) products.add(product);
    onProgress?.({ phase: 'discovery', completed: ++listingsCompleted });
  }

  const urls = [...products];
  const pages: ProductPage[] = [];
  let productsCompleted = 0;
  onProgress?.({ phase: 'products', completed: 0, total: urls.length });
  for (let index = 0; index < urls.length; index += concurrency) {
    signal?.throwIfAborted();
    const batch = await Promise.all(
      urls.slice(index, index + concurrency).map(async (url) => {
        const html = await retrieve(url);
        const $ = load(html);
        if ($('.test-site .thumbnail h4.title').length !== 1) {
          throw new Error(`Unexpected product page structure at ${url}`);
        }
        signal?.throwIfAborted();
        onProgress?.({
          phase: 'products',
          completed: ++productsCompleted,
          total: urls.length,
        });
        return { url, html };
      }),
    );
    pages.push(...batch);
  }
  return pages;
}
