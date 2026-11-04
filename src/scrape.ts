import { aggregateProducts } from './aggregate.js';
import type { CatalogueProgress } from './catalogue.js';
import { collectProductPages } from './catalogue.js';
import { parseProductPage } from './parse.js';
import type { ScrapeResult } from './product.js';

export { TARGET_URL } from './site.js';

export type ScrapeProgress =
  | CatalogueProgress
  | { phase: 'processing'; total: number };

export async function scrape(
  options: {
    signal?: AbortSignal;
    onProgress?: (event: ScrapeProgress) => void;
  } = {},
): Promise<ScrapeResult> {
  const pages = await collectProductPages(options);
  options.signal?.throwIfAborted();
  options.onProgress?.({ phase: 'processing', total: pages.length });
  return aggregateProducts(pages.flatMap(parseProductPage));
}
