import { describe, expect, it } from 'vitest';
import { productSchema } from '../product.js';

const product = {
  name: 'Example laptop 128 GB',
  description: 'Example product description',
  price: 1178.19,
};

describe('product contract', () => {
  it('accepts a product without colour options', () => {
    expect(productSchema.parse(product)).toEqual(product);
  });

  it('accepts multiple colour options', () => {
    const input = { ...product, colors: ['gold', 'white', 'black'] };
    expect(productSchema.parse(input)).toEqual(input);
  });

  it.each([{ colors: [] }, { colors: ['gold'] }])(
    'requires multiple colours when present: %j',
    ({ colors }) => {
      expect(productSchema.safeParse({ ...product, colors }).success).toBe(
        false,
      );
    },
  );

  it.each([
    { ...product, name: ' ' },
    { ...product, description: '' },
    { ...product, price: '$1178.19' },
    { ...product, price: -1 },
    { ...product, price: Number.NaN },
    { ...product, price: Number.POSITIVE_INFINITY },
  ])('rejects malformed product data: %j', (input) => {
    expect(productSchema.safeParse(input).success).toBe(false);
  });
});
