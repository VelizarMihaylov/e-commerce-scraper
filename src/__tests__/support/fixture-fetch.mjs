// Test-only Node preload. Every request receives a controlled Response; no network fallback.
import { readFileSync } from 'node:fs';
import { load } from 'cheerio';

const root = 'https://webscraper.io/test-sites/e-commerce/static';
const scenario = process.env.SCRAPER_TEST_SCENARIO;
const fixture = (name) =>
  readFileSync(
    new URL(`../fixtures/catalogue/${name}.html`, import.meta.url),
    'utf8',
  );
// Synthetic navigation graph combines captured detail pages, with repeated featured links.
const listing = (
  ids,
  navigation = '',
  pagination = '',
) => `<div class="test-site">
<ul id="side-menu">${navigation}</ul>
${ids.map((id) => `<a class="title" href="${root}/product/${id}">Product</a>`).join('')}
<div id="static-pagination">${pagination}</div></div>`;
const pages = new Map([
  [
    root,
    listing(
      [3],
      `<a class="category-link" href="${root}/computers">Computers</a>`,
    ),
  ],
  [
    `${root}/computers`,
    listing(
      [3, 10],
      '',
      `<a rel="next" href="${root}/computers?page=2">Next</a>`,
    ),
  ],
  [
    `${root}/computers?page=2`,
    listing(
      [136, 7, 8, 9],
      `<a class="category-link" href="${root}/computers?page=1">Back</a>`,
    ),
  ],
  [`${root}/product/3`, fixture('phone-colors')],
  [`${root}/product/10`, fixture('tablet-storage-colors')],
  [`${root}/product/136`, fixture('laptop-storage')],
]);
// Synthetic detail pages model the distinct equal-name/price IDs observed in phones-last.html.
const phone = load(fixture('phone-colors'));
phone('h4.title').text('Iphone');
phone('p.description').text('White');
phone('[itemprop="price"]').text('$899.99');
for (const id of [7, 8, 9]) pages.set(`${root}/product/${id}`, phone.html());
if (scenario === 'parse-failure') {
  const invalid = load(fixture('laptop-storage'));
  invalid('p.description').remove();
  pages.set(`${root}/product/136`, invalid.html());
}

globalThis.fetch = (input) => {
  const url = String(input);
  if (!scenario || scenario === 'no-network')
    throw new Error(`Unexpected network request: ${url}`);
  if (scenario === 'retrieval-failure' && url === `${root}/product/136`) {
    return Promise.resolve(new Response('Missing product', { status: 404 }));
  }
  const html = pages.get(url);
  if (!html) throw new Error(`Unmapped fixture request: ${url}`);
  return Promise.resolve(
    new Response(html, { headers: { 'Content-Type': 'text/html' } }),
  );
};
