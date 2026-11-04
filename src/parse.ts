import { load } from 'cheerio';
import type { ProductPage } from './catalogue.js';
import { isProductUrl, normalizeCatalogueUrl, TARGET_URL } from './site.js';

export interface ParsedProduct {
  url: string;
  storage?: string;
  name: string;
  description: string;
  priceCents: number;
  colors?: string[];
}

// Absolute modifiers from the site's EcommerceProduct handler, verified in #3.
// See docs/catalogue-investigation.md; never execute downloaded JavaScript.
const storageModifiers = new Map([
  ['128', 0],
  ['256', 2000],
  ['512', 4000],
  ['1024', 6000],
]);

export function parseDollarPrice(value: string): number {
  const match = /^\$(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid dollar price: ${value}`);
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents))
    throw new Error('Price exceeds safe integer cents');
  return cents;
}

export function parseProductPage(page: ProductPage): ParsedProduct[] {
  try {
    const url = normalizeCatalogueUrl(page.url, TARGET_URL);
    if (!url || !isProductUrl(url)) throw new Error('Invalid product URL');
    const $ = load(page.html);
    const product = $('.test-site .thumbnail');
    if (product.length !== 1) throw new Error('Expected one product detail');

    function requiredText(selector: string, field: string): string {
      const elements = product.find(selector);
      const text = elements.text().replace(/\s+/g, ' ').trim();
      if (elements.length !== 1 || !text)
        throw new Error(`Missing or ambiguous ${field}`);
      return text;
    }

    const name = requiredText('h4.title[itemprop="name"]', 'name');
    const description = requiredText('p.description', 'description');
    const currency = product.find('h4.price meta[itemprop="priceCurrency"]');
    if (currency.length !== 1 || currency.attr('content') !== 'USD') {
      throw new Error('Expected USD price currency');
    }
    const priceCents = parseDollarPrice(requiredText('h4.price', 'price'));
    const colorSelect = product.find('select[aria-label="color"]');
    if (colorSelect.length > 1) throw new Error('Ambiguous colour controls');
    const colors = new Set<string>();
    for (const element of colorSelect.find('option')) {
      const option = $(element);
      if (option.closest('[disabled], [aria-disabled="true"]').length) continue;
      const color = (option.attr('value') ?? '').trim().toLowerCase();
      if (color) colors.add(color);
    }
    const base: ParsedProduct = {
      url,
      name,
      description,
      priceCents,
      ...(colors.size > 1 ? { colors: [...colors] } : {}),
    };

    const swatches = product.find('.swatches');
    if (swatches.length === 0) return [base];
    if (swatches.length !== 1) throw new Error('Ambiguous storage controls');
    const buttons = swatches.find('button.swatch');
    const enabled = buttons.filter(
      (_, element) =>
        $(element).closest('[disabled], [aria-disabled="true"], .disabled')
          .length === 0,
    );
    const active = buttons.filter('.active');
    if (
      active.length !== 1 ||
      active.attr('value') !== '128' ||
      !enabled.is(active)
    ) {
      throw new Error(
        'Expected enabled 128 GB as the initial storage configuration',
      );
    }
    const configurations = new Map<string, ParsedProduct>();
    for (const element of enabled) {
      const storage = $(element).attr('value')?.trim() ?? '';
      const modifier = storageModifiers.get(storage);
      if (modifier === undefined)
        throw new Error(
          `Unknown enabled storage configuration: ${storage || '(missing)'}`,
        );
      const configuredPrice = priceCents + modifier;
      if (!Number.isSafeInteger(configuredPrice))
        throw new Error('Configuration price exceeds safe integer cents');
      configurations.set(storage, {
        ...base,
        storage,
        name: `${name} ${storage} GB`,
        priceCents: configuredPrice,
      });
    }
    return [...configurations.values()];
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown parsing failure';
    throw new Error(`Could not parse ${page.url}: ${message}`, {
      cause: error,
    });
  }
}
