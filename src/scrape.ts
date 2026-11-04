import type { ScrapeResult } from './product.js';

export const TARGET_URL = 'https://webscraper.io/test-sites/e-commerce/static';

export function scrape(): Promise<ScrapeResult> {
  // Fail explicitly until catalogue traversal and product parsing are implemented.
  return Promise.reject(new Error('Scraping is not implemented yet.'));
}
