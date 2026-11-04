import { readFileSync } from 'node:fs';
import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { parseDollarPrice, parseProductPage } from '../parse.js';
import { TARGET_URL } from '../site.js';

const fixture = (name: string) =>
  readFileSync(
    new URL(`./fixtures/catalogue/${name}.html`, import.meta.url),
    'utf8',
  );
const url = `${TARGET_URL}/product/136`;
// Mutations below are explicitly synthetic edge cases, not live-site observations.
function altered(name: string, change: (html: CheerioAPI) => void): string {
  const $ = load(fixture(name));
  change($);
  return $.html();
}

describe('product extraction', () => {
  it('expands enabled laptop storage with non-cumulative prices and unchanged description', () => {
    const products = parseProductPage({ url, html: fixture('laptop-storage') });
    expect(products).toEqual([
      {
        url,
        storage: '128',
        name: 'Dell Latitude 5480 128 GB',
        description:
          'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
        priceCents: 131039,
      },
      {
        url,
        storage: '256',
        name: 'Dell Latitude 5480 256 GB',
        description:
          'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
        priceCents: 133039,
      },
      {
        url,
        storage: '512',
        name: 'Dell Latitude 5480 512 GB',
        description:
          'Dell Latitude 5480, 14" FHD, Core i7-7600U, 8GB, 256GB SSD, Windows 10 Pro',
        priceCents: 135039,
      },
    ]);
  });

  it('attaches colours to each tablet configuration without a colour cross-product', () => {
    expect(
      parseProductPage({ url, html: fixture('tablet-storage-colors') }),
    ).toEqual([
      {
        url,
        storage: '128',
        name: 'Lenovo IdeaTab 128 GB',
        description: '7" screen, Android',
        priceCents: 6999,
        colors: ['gold', 'white', 'black'],
      },
      {
        url,
        storage: '256',
        name: 'Lenovo IdeaTab 256 GB',
        description: '7" screen, Android',
        priceCents: 8999,
        colors: ['gold', 'white', 'black'],
      },
      {
        url,
        storage: '512',
        name: 'Lenovo IdeaTab 512 GB',
        description: '7" screen, Android',
        priceCents: 10999,
        colors: ['gold', 'white', 'black'],
      },
    ]);
  });

  it('keeps the original phone title and normalizes distinct available colours', () => {
    const html = altered('phone-colors', ($) => {
      $('select').append(
        '<option value=" GOLD ">Duplicate</option><option value="Red" disabled>Red</option>',
      );
    });
    expect(parseProductPage({ url, html })).toEqual([
      {
        url,
        name: 'Samsung Galaxy',
        description: '5 mpx. Android 5.0',
        priceCents: 9399,
        colors: ['gold', 'white', 'black'],
      },
    ]);
  });

  it('preserves the full detail title instead of the truncated listing title', () => {
    expect(
      parseProductPage({ url, html: fixture('laptop-long-name') }).map(
        ({ name, priceCents }) => ({ name, priceCents }),
      ),
    ).toEqual([
      {
        name: 'Asus VivoBook Pro 15 N580VN-FI006T Gold Metal 128 GB',
        priceCents: 123549,
      },
      {
        name: 'Asus VivoBook Pro 15 N580VN-FI006T Gold Metal 256 GB',
        priceCents: 125549,
      },
      {
        name: 'Asus VivoBook Pro 15 N580VN-FI006T Gold Metal 512 GB',
        priceCents: 127549,
      },
    ]);
  });

  it('handles a synthetic ordinary product, entities and whitespace', () => {
    expect(
      parseProductPage({ url, html: fixture('synthetic/ordinary') }),
    ).toEqual([
      {
        url,
        name: 'Plain & Simple',
        description: 'A simple product & description.',
        priceCents: 139900,
      },
    ]);
  });

  it('omits colours for a synthetic single distinct available colour', () => {
    expect(
      parseProductPage({ url, html: fixture('synthetic/single-color') }),
    ).toEqual([
      {
        url,
        name: 'Single colour product',
        description: 'A synthetic product.',
        priceCents: 37270,
      },
    ]);
  });

  it('includes 1024 when enabled instead of excluding it by numeric value', () => {
    const html = altered('laptop-storage', ($) => {
      $('[value="1024"]').removeAttr('disabled');
    });
    expect(parseProductPage({ url, html }).at(-1)).toMatchObject({
      storage: '1024',
      name: 'Dell Latitude 5480 1024 GB',
      priceCents: 137039,
    });
  });

  it('deduplicates repeated storage values and ignores unfamiliar disabled values', () => {
    const html = altered('laptop-storage', ($) => {
      $('.swatches').append(
        '<button class="swatch" value="256">256</button><button class="swatch" value="2048" disabled>2048</button>',
      );
    });
    expect(parseProductPage({ url, html }).map((p) => p.storage)).toEqual([
      '128',
      '256',
      '512',
    ]);
  });

  it('canonicalizes product URL aliases for downstream identity', () => {
    expect(
      parseProductPage({
        url: `${url}/?tracking=1#reviews`,
        html: fixture('phone-colors'),
      })[0]?.url,
    ).toBe(url);
  });

  const invalidCases: [string, (html: CheerioAPI) => void, string][] = [
    [
      'missing name',
      ($) => {
        $('h4.title').remove();
      },
      'name',
    ],
    [
      'empty description',
      ($) => {
        $('p.description').text('  ');
      },
      'description',
    ],
    [
      'missing price',
      ($) => {
        $('h4.price').remove();
      },
      'currency',
    ],
    [
      'malformed price',
      ($) => {
        $('[itemprop="price"]').text('$1.234');
      },
      'Invalid dollar price',
    ],
    [
      'wrong currency',
      ($) => {
        $('[itemprop="priceCurrency"]').attr('content', 'EUR');
      },
      'USD',
    ],
    [
      'unknown enabled storage',
      ($) => {
        $('[value="256"]').attr('value', '2048');
      },
      'Unknown enabled storage',
    ],
    [
      'missing storage value',
      ($) => {
        $('[value="256"]').removeAttr('value');
      },
      'Unknown enabled storage',
    ],
    [
      'different initial storage',
      ($) => {
        $('.active').removeClass('active');
        $('[value="256"]').addClass('active');
      },
      'initial storage',
    ],
    [
      'missing initial storage',
      ($) => {
        $('.active').removeClass('active');
      },
      'initial storage',
    ],
    [
      'disabled initial storage',
      ($) => {
        $('.active').attr('disabled', '');
      },
      'initial storage',
    ],
    [
      'ambiguous initial storage',
      ($) => {
        $('[value="256"]').addClass('active');
      },
      'initial storage',
    ],
    [
      'empty storage controls',
      ($) => {
        $('.swatches').empty();
      },
      'initial storage',
    ],
    [
      'ambiguous product',
      ($) => {
        $('.test-site').append($('.thumbnail').clone());
      },
      'one product detail',
    ],
  ];
  it.each(invalidCases)(
    'fails with product context for %s',
    (_label, change, reason) => {
      expect(() =>
        parseProductPage({ url, html: altered('laptop-storage', change) }),
      ).toThrow(url);
      expect(() =>
        parseProductPage({ url, html: altered('laptop-storage', change) }),
      ).toThrow(reason);
    },
  );
  it('rejects invalid product identity', () => {
    expect(() =>
      parseProductPage({
        url: 'https://example.com/product/1',
        html: fixture('phone-colors'),
      }),
    ).toThrow('Invalid product URL');
  });
});

describe('dollar price parsing', () => {
  it.each([
    ['$1399', 139900],
    ['$372.7', 37270],
    ['$1178.19', 117819],
    ['$0.01', 1],
    ['$0', 0],
    [' $0.10 ', 10],
  ])('parses %s into integer cents', (value, cents) => {
    expect(parseDollarPrice(value)).toBe(cents);
  });
  it.each([
    '',
    'free',
    '-$1',
    '$-1',
    '$1.001',
    '$1e3',
    '$NaN',
    '€10',
    '$1,23',
    '$90071992547410',
  ])('rejects malformed or unsafe money %s', (value) => {
    expect(() => parseDollarPrice(value)).toThrow();
  });
});
