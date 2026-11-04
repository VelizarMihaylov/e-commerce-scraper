import type { ScrapeResult } from './product.js';

export { TARGET_URL } from './site.js';

export function scrape(): Promise<ScrapeResult> {
  // Fail explicitly until catalogue traversal and product parsing are implemented.
  return Promise.reject(new Error('Scraping is not implemented yet.'));
}
