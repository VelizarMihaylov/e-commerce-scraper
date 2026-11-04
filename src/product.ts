import { z } from 'zod';

export const productSchema = z.strictObject({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  price: z.number().nonnegative(),
  colors: z.array(z.string().trim().min(1)).min(2).optional(),
});

export const scrapeResultSchema = z.strictObject({
  results: z.array(productSchema),
  total: z.number().nonnegative(),
});

export type Product = z.infer<typeof productSchema>;
export type ScrapeResult = z.infer<typeof scrapeResultSchema>;
