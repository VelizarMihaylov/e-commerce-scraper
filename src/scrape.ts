import { aggregateProducts } from './aggregate.js';
import { collectProductPages } from './catalogue.js';
import { parseProductPage } from './parse.js';
import type { ScrapeResult } from './product.js';

export { TARGET_URL } from './site.js';

export async function scrape(): Promise<ScrapeResult> {
  const pages = await collectProductPages();
  return aggregateProducts(pages.flatMap(parseProductPage));
}
