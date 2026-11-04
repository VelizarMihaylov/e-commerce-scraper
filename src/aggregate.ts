import type { ParsedProduct } from './parse.js';
import { scrapeResultSchema } from './product.js';
import type { Product, ScrapeResult } from './product.js';

export function aggregateProducts(
  products: readonly ParsedProduct[],
): ScrapeResult {
  const seen = new Set<string>();
  const results: Product[] = [];
  let totalCents = 0;
  for (const product of products) {
    const identity = JSON.stringify([product.url, product.storage ?? null]);
    if (seen.has(identity)) continue;
    if (!Number.isSafeInteger(product.priceCents) || product.priceCents < 0) {
      throw new Error(`Invalid price in cents for ${product.url}`);
    }
    seen.add(identity);
    totalCents += product.priceCents;
    if (!Number.isSafeInteger(totalCents))
      throw new Error('Total exceeds safe integer cents');
    results.push({
      name: product.name,
      description: product.description,
      price: product.priceCents / 100,
      ...(product.colors ? { colors: product.colors } : {}),
    });
  }
  return scrapeResultSchema.parse({ results, total: totalCents / 100 });
}
