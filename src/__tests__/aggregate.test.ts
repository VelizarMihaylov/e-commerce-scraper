import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregateProducts } from '../aggregate.js';
import { parseProductPage } from '../parse.js';
import type { ParsedProduct } from '../parse.js';
import { TARGET_URL } from '../site.js';

const product = (id: number, priceCents = 89999): ParsedProduct => ({
  url: `${TARGET_URL}/product/${id}`,
  name: 'Iphone',
  description: 'Same name and price, separate identity.',
  priceCents,
});

describe('product aggregation', () => {
  it('retains distinct IDs with equal prices but ignores repeated identities', () => {
    expect(
      aggregateProducts([product(7), product(8), product(7), product(9)]),
    ).toEqual({
      results: [
        {
          name: 'Iphone',
          description: 'Same name and price, separate identity.',
          price: 899.99,
        },
        {
          name: 'Iphone',
          description: 'Same name and price, separate identity.',
          price: 899.99,
        },
        {
          name: 'Iphone',
          description: 'Same name and price, separate identity.',
          price: 899.99,
        },
      ],
      total: 2699.97,
    });
  });

  it('keeps configuration identities distinct and deduplicates repeated configurations', () => {
    const first = {
      ...product(10, 6999),
      storage: '128',
      name: 'Tablet 128 GB',
      colors: ['gold', 'black'],
    };
    const second = {
      ...first,
      storage: '256',
      name: 'Tablet 256 GB',
      priceCents: 8999,
    };
    expect(aggregateProducts([first, second, { ...first }])).toEqual({
      results: [
        {
          name: 'Tablet 128 GB',
          description: first.description,
          price: 69.99,
          colors: ['gold', 'black'],
        },
        {
          name: 'Tablet 256 GB',
          description: first.description,
          price: 89.99,
          colors: ['gold', 'black'],
        },
      ],
      total: 159.98,
    });
  });

  it('sums cents before converting to JSON numbers', () => {
    expect(aggregateProducts([product(1, 10), product(2, 20)]).total).toBe(0.3);
  });

  it('aggregates captured product fixtures with an exact expected total and only contract fields', () => {
    const pages = [
      [3, 'phone-colors'],
      [10, 'tablet-storage-colors'],
      [136, 'laptop-storage'],
    ] as const;
    const parsed = pages.flatMap(([id, name]) =>
      parseProductPage({
        url: `${TARGET_URL}/product/${id}`,
        html: readFileSync(
          new URL(`./fixtures/catalogue/${name}.html`, import.meta.url),
          'utf8',
        ),
      }),
    );
    const output = aggregateProducts([...parsed, ...parsed]);
    expect(output.total).toBe(4355.13);
    expect(output.results).toHaveLength(7);
    expect(Object.keys(output)).toEqual(['results', 'total']);
    for (const result of output.results) {
      expect(Object.keys(result).sort()).toEqual(
        result.colors
          ? ['colors', 'description', 'name', 'price']
          : ['description', 'name', 'price'],
      );
    }
  });

  it.each([-1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid internal cents %s',
    (priceCents) => {
      expect(() => aggregateProducts([product(1, priceCents)])).toThrow(
        `${TARGET_URL}/product/1`,
      );
    },
  );

  it('rejects total overflow', () => {
    expect(() =>
      aggregateProducts([product(1, Number.MAX_SAFE_INTEGER), product(2, 1)]),
    ).toThrow('Total exceeds safe integer cents');
  });
});
